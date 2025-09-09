"""
API версия агентной системы для технических интервью
Поддерживает пошаговое и автоматическое проведение интервью
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Dict, Optional, Any, List
import uuid
from datetime import datetime
from ml_system.interview.interview_system import InterviewSystem
from ml_system.job_matching import FlexibleResumeMatcher
from langchain_core.messages import HumanMessage, AIMessage
import os
from dotenv import load_dotenv
from pymongo import MongoClient
from bson import ObjectId

# Загружаем переменные окружения из .env файла
load_dotenv()

try:
    mongo_uri = os.getenv('MONGO_URI', 'mongodb://mongo:27017')
    client = MongoClient(mongo_uri)
    db = client.aihr_database
    vacancies_collection = db.vacancies

    print("MongoDB подключена успешно!")
except Exception as e:
    print(f"Ошибка подключения к MongoDB: {e}")

# Модели данных для API
class InterviewRequest(BaseModel):
    resume: str
    job_description: Optional[str] = None
    vacancy_id: Optional[str] = None

class AnswerRequest(BaseModel):
    interview_id: str
    answer: str

class InterviewResponse(BaseModel):
    interview_id: str
    status: str
    current_question: Optional[str] = None
    question_source: Optional[str] = None
    current_topic: Optional[str] = None
    progress: Optional[Dict] = None
    report: Optional[str] = None
    recommendation: Optional[str] = None
    error: Optional[str] = None
    debug: Optional[Dict[str, Any]] = None

class InterviewStatus(BaseModel):
    interview_id: str
    status: str  # "waiting_for_answer", "completed", "error"
    current_topic: Optional[str] = None
    questions_asked: int = 0
    questions_in_current_topic: int = 0
    deepening_questions_count: int = 0
    hints_given_count: int = 0
    total_topics: int = 8
    progress_percent: float = 0.0
    created_at: Optional[str] = None

class ResumeMatchRequest(BaseModel):
    resume: str
    required_skills: Optional[list[str]] = None
    optional_skills: Optional[list[str]] = None
    min_experience: Optional[float] = None
    max_experience: Optional[float] = None
    education_required: Optional[str] = None
    weights: Optional[Dict[str, float]] = None
    vacancy_id: Optional[str] = None

class ResumeMatchResponse(BaseModel):
    total_score_percent: int
    details: Dict[str, Any]

# Глобальное хранилище активных интервью
active_interviews: Dict[str, Dict] = {}

class APIInterviewSystem:
    """API версия системы интервью"""
    
    def __init__(self, api_key: str):
        # Глобальная система по умолчанию (используется, если не переданы знания)
        self.interview_system = InterviewSystem(api_key)
        self.interview_system.load_knowledge(knowledge_file="data/ml_interview_bank_ru.json")
        
    def create_interview(self, resume: str, job_description: str, role: Optional[str] = None, knowledge: Optional[List[Dict[str, Any]]] = None) -> str:
        """Создает новое интервью и возвращает ID"""
        interview_id = str(uuid.uuid4())
        
        # Для каждого интервью создаем отдельный экземпляр системы с отдельной коллекцией
        # Имя коллекции связываем с ID интервью (или пользователем, если у вас есть user_id)
        collection_name = f"interview_{interview_id}"
        per_interview_system = InterviewSystem(
            os.getenv("OPENROUTER_API_KEY", ""),
            collection_name=collection_name
        )
        
        # Если переданы знания — загружаем их в отдельную векторную БД этого интервью
        # Если не переданы — можно опционально загрузить дефолтный банк вопросов
        if knowledge and isinstance(knowledge, list) and len(knowledge) > 0:
            per_interview_system.load_knowledge(knowledge_json=knowledge)
        else:
            # Чтобы интервью не было пустым, подстрахуемся дефолтным банком
            per_interview_system.load_knowledge(knowledge_file="data/ml_interview_bank_ru.json")
        
        # Создаем начальное состояние (как в консольной версии)
        initial_state = {
            "resume": resume,
            "job_description": job_description,
            "role": role or "",
            "messages": [],
            "questions_asked_count": 0,
            "questions_in_current_topic": 0,
            "deepening_questions_count": 0,
            "hints_given_count": 0,
            "current_topic_index": 0,
            "answer_evaluations": [],
            "asked_question_ids": set(),
            "interview_plan": None,
            "current_topic": None,
            "current_question": None,
            "last_candidate_answer": None,
            "final_recommendation": None,
            "report": None,
            "generated_question": None,
            "controller_decision": None,
            "completed_topics": set(),
            "skip_topic": False,
            "question_type": None,
            "last_question_type": None
        }
        
        # Сохраняем в глобальном хранилище
        active_interviews[interview_id] = {
            "state": initial_state,
            "status": "created",
            "created_at": datetime.now(),
            "current_step": "planner",
            # Храним ссылку на систему с отдельной коллекцией
            "system": per_interview_system
        }
        
        return interview_id
    
    def get_next_question(self, interview_id: str) -> Dict:
        """Получает следующий вопрос для интервью (как в консольной версии)"""
        if interview_id not in active_interviews:
            raise HTTPException(status_code=404, detail="Interview not found")
        
        interview_data = active_interviews[interview_id]
        state = interview_data["state"]
        current_step = interview_data["current_step"]
        # Используем систему, привязанную к этому интервью
        system = interview_data.get("system", self.interview_system)
        
        try:
            if current_step == "planner":
                # Запускаем планировщик
                result = system._interview_planner(state)
                state.update(result)
                interview_data["current_step"] = "selector"
                current_step = "selector"
                
            if current_step == "selector":
                # Запускаем селектор вопросов
                result = system._question_selector(state)
                if not result:  # Интервью завершено
                    interview_data["status"] = "completed"
                    return self._generate_final_report(interview_id)
                
                state.update(result)
                interview_data["current_step"] = "waiting_for_answer"
                
                # Возвращаем вопрос (источник берем из структуры вопроса, если есть)
                question = state.get("current_question", {})
                source = question.get("source") or "Selector"
                # Подготовка отладочной информации
                debug_info = {
                    "step": "selector",
                    "controller_decision": state.get("controller_decision"),
                    "generated_question": state.get("generated_question"),
                    "skip_topic": state.get("skip_topic"),
                    "question_type": state.get("question_type"),
                    "last_question_type": state.get("last_question_type"),
                    "last_evaluation": (state.get("answer_evaluations", [])[-1]
                                         if state.get("answer_evaluations") else None)
                }
                return {
                    "interview_id": interview_id,
                    "status": "waiting_for_answer",
                    "current_question": question.get("content"),
                    "question_source": source,
                    "current_topic": state.get("current_topic"),
                    "progress": {
                        "questions_asked": state.get("questions_asked_count", 0),
                        "questions_in_current_topic": state.get("questions_in_current_topic", 0),
                        "deepening_questions_count": state.get("deepening_questions_count", 0),
                        "hints_given_count": state.get("hints_given_count", 0),
                        "total_topics": len(state.get("interview_plan", {}).get("topics", [])),
                        "current_topic": state.get("current_topic")
                    },
                    "debug": debug_info
                }
                
        except Exception as e:
            interview_data["status"] = "error"
            raise HTTPException(status_code=500, detail=f"Error getting question: {str(e)}")
    
    def submit_answer(self, interview_id: str, answer: str) -> Dict:
        """Отправляет ответ кандидата и получает следующий вопрос (как в консольной версии)"""
        if interview_id not in active_interviews:
            raise HTTPException(status_code=404, detail="Interview not found")
        
        interview_data = active_interviews[interview_id]
        state = interview_data["state"]
        system = interview_data.get("system", self.interview_system)
        
        if interview_data["current_step"] != "waiting_for_answer":
            raise HTTPException(status_code=400, detail="Not waiting for answer")
        
        try:
            # Обновляем состояние с ответом (как в консольной версии)
            current_question = state.get("current_question", {})
            asked_ids = state.get("asked_question_ids", set())
            asked_ids.add(current_question.get("id", "current_question"))
            
            state.update({
                "messages": [AIMessage(content=current_question.get("content", "")), 
                           HumanMessage(content=answer)],
                "last_candidate_answer": answer,
                "asked_question_ids": asked_ids
            })
            
            # Оцениваем ответ
            evaluation_result = system._answer_evaluator(state)
            state.update(evaluation_result)
            
            # Запускаем контроллер
            controller_result = system._adaptive_controller_node(state)
            state.update(controller_result)
            
            # Определяем следующий шаг (как в консольной версии)
            next_step = self._determine_next_step(state)
            interview_data["current_step"] = next_step
            
            if next_step == "completed":
                return self._generate_final_report(interview_id)
            elif next_step == "waiting_for_answer":
                # Контроллер предлагает вопрос. Прогоняем менеджер диалога, чтобы зафиксировать вопрос и инкременты
                manager_result = system._conversation_manager(state)
                state.update(manager_result)
                interview_data["current_step"] = "waiting_for_answer"
                
                question = state.get("current_question", {})
                source = question.get("source") or ("LLM-Generated" if state.get("generated_question") else "Selector")
                debug_info = {
                    "step": "controller_waiting",
                    "controller_decision": state.get("controller_decision"),
                    "generated_question": state.get("generated_question"),
                    "skip_topic": state.get("skip_topic"),
                    "question_type": state.get("question_type"),
                    "last_question_type": state.get("last_question_type"),
                    "last_evaluation": (state.get("answer_evaluations", [])[-1]
                                         if state.get("answer_evaluations") else None)
                }
                return {
                    "interview_id": interview_id,
                    "status": "waiting_for_answer",
                    "current_question": question.get("content"),
                    "question_source": source,
                    "current_topic": state.get("current_topic"),
                    "progress": {
                        "questions_asked": state.get("questions_asked_count", 0),
                        "questions_in_current_topic": state.get("questions_in_current_topic", 0),
                        "deepening_questions_count": state.get("deepening_questions_count", 0),
                        "hints_given_count": state.get("hints_given_count", 0),
                        "total_topics": len(state.get("interview_plan", {}).get("topics", [])),
                        "current_topic": state.get("current_topic")
                    },
                    "debug": debug_info
                }
            else:
                # Получаем следующий вопрос
                return self.get_next_question(interview_id)
                
        except Exception as e:
            interview_data["status"] = "error"
            raise HTTPException(status_code=500, detail=f"Error processing answer: {str(e)}")
    
    def _determine_next_step(self, state: Dict) -> str:
        """Определяет следующий шаг на основе решения контроллера (как в консольной версии)"""
        controller_decision = state.get("controller_decision")
        generated_question = state.get("generated_question")
        skip_topic = state.get("skip_topic", False)
        
        # Проверяем условия завершения ПЕРВЫМИ (как в консольной версии)
        interview_plan = state.get("interview_plan", {})
        max_total_questions = interview_plan.get("max_total_questions", 30)
        questions_asked = state.get("questions_asked_count", 0)
        topics = interview_plan.get("topics", [])
        current_topic_index = state.get("current_topic_index", 0)
        
        # Условия завершения
        if questions_asked >= max_total_questions:
            return "completed"
        
        if current_topic_index >= len(topics):
            return "completed"
        
        # Обработка решений контроллера
        if controller_decision == "continue_topic" and generated_question:
            return "waiting_for_answer"  # Используем сгенерированный вопрос
        elif controller_decision == "skip_topic" or skip_topic:
            return "selector"  # Переходим к следующей теме
        elif controller_decision == "continue_standard":
            return "selector"  # Продолжаем стандартный поток
        else:
            return "selector"  # По умолчанию - к селектору
    
    def _generate_final_report(self, interview_id: str) -> Dict:
        """Генерирует финальный отчет (как в консольной версии)"""
        interview_data = active_interviews[interview_id]
        state = interview_data["state"]
        
        # Запускаем генератор отчетов
        report_result = self.interview_system._report_generator(state)
        state.update(report_result)
        
        interview_data["status"] = "completed"
        
        return {
            "interview_id": interview_id,
            "status": "completed",
            "report": state.get("report"),
            "recommendation": state.get("final_recommendation"),
            "progress": {
                "questions_asked": state.get("questions_asked_count", 0),
                "questions_in_current_topic": state.get("questions_in_current_topic", 0),
                "deepening_questions_count": state.get("deepening_questions_count", 0),
                "hints_given_count": state.get("hints_given_count", 0),
                "total_topics": len(state.get("interview_plan", {}).get("topics", [])),
                "completed": True
            }
        }
    
    def get_interview_status(self, interview_id: str) -> Dict:
        """Получает статус интервью (как в консольной версии)"""
        if interview_id not in active_interviews:
            raise HTTPException(status_code=404, detail="Interview not found")
        
        interview_data = active_interviews[interview_id]
        state = interview_data["state"]
        
        total_topics = len(state.get("interview_plan", {}).get("topics", []))
        questions_asked = state.get("questions_asked_count", 0)
        progress_percent = (questions_asked / total_topics * 100) if total_topics > 0 else 0
        
        return {
            "interview_id": interview_id,
            "status": interview_data["status"],
            "current_topic": state.get("current_topic"),
            "questions_asked": questions_asked,
            "questions_in_current_topic": state.get("questions_in_current_topic", 0),
            "deepening_questions_count": state.get("deepening_questions_count", 0),
            "hints_given_count": state.get("hints_given_count", 0),
            "total_topics": total_topics,
            "progress_percent": progress_percent,
            "created_at": interview_data["created_at"].isoformat()
        }


# Инициализация API
app = FastAPI(title="AI Interview System API", version="1.0.0")

# Глобальный экземпляр системы (инициализируется при запуске)
api_system = None

@app.on_event("startup")
async def startup_event():
    """Инициализация системы при запуске"""
    global api_system
    # Читаем ключ из переменной окружения для безопасности
    api_key = os.getenv("OPENROUTER_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("OPENROUTER_API_KEY не задан. Установите переменную окружения с вашим OpenRouter API ключом.")
    api_system = APIInterviewSystem(api_key)
    print("✅ API Interview System initialized")

# API Endpoints

@app.post("/interviews", response_model=InterviewResponse)
async def create_interview(request: InterviewRequest):
    """Создает новое интервью"""
    try:
        vacancy_id = request.vacancy_id
        print(f"📋 vacancy_id: {vacancy_id}")
        vacancy = vacancies_collection.find_one({'_id': ObjectId(vacancy_id)})
        print(f"📊 Найдена вакансия: {vacancy is not None}")

        # --- Сборка текста в одну строку ---
        parts = []
        
        # Проверяем что вакансия найдена
        if vacancy is None:
            print(f"⚠️ Вакансия с ID {vacancy_id} не найдена, используем стандартное описание")
            summary_text = request.job_description or "Ищем Middle ML разработчика для задач NLP и CV."
        else:
            # Заголовок и грейд
            if 'title' in vacancy and 'grade' in vacancy:
                parts.append(f"Название вакансии: {vacancy['grade']} {vacancy['title']}")
            
            # Направление работы
            if 'work_field' in vacancy:
                parts.append(f"Направление: {vacancy['work_field']}")
        
        # Опыт работы
        if 'min_experience' in vacancy and 'max_experience' in vacancy:
            parts.append(f"Опыт работы: от {vacancy['min_experience']} до {vacancy['max_experience']} лет.")
            
        # Обязательные навыки
        if vacancy.get('required_skills'): # .get() для безопасного доступа
            skills_str = ", ".join(vacancy['required_skills'])
            parts.append(f"\nОбязательные навыки:\n- {skills_str}")
        
        # Дополнительные навыки
        if vacancy.get('optional_skills'):
            skills_str = ", ".join(vacancy['optional_skills'])
            parts.append(f"\nБудет плюсом:\n- {skills_str}")
        
        # Описание вакансии
        if 'description' in vacancy:
            parts.append(f"\nОписание вакансии:\n{vacancy['description']}")
        
        # Описание компании
        if 'company_description' in vacancy:
            parts.append(f"\nОписание компании:\n{vacancy['company_description']}")
        knowledge = vacancy.get('questions')
        role = vacancy.get('work_field')
        
        # Собираем все части в один текст с переносами строк
        summary_text = "\n".join(parts) 

        # print(f"📝 Используем job_description: {summary_text[:100]}...")
        try:
            interview_id = api_system.create_interview(
                resume=request.resume,
                job_description=summary_text,
                role=role,
                knowledge=knowledge
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
        print(f"✅ Интервью создано: {interview_id}")
        
        # Получаем первый вопрос
        response = api_system.get_next_question(interview_id)
        return InterviewResponse(**response)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/interviews/{interview_id}/answer", response_model=InterviewResponse)
async def submit_answer(interview_id: str, request: AnswerRequest):
    """Отправляет ответ кандидата"""
    try:
        response = api_system.submit_answer(interview_id, request.answer)
        return InterviewResponse(**response)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/interviews/{interview_id}/status", response_model=InterviewStatus)
async def get_interview_status(interview_id: str):
    """Получает статус интервью"""
    try:
        status = api_system.get_interview_status(interview_id)
        return InterviewStatus(**status)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/interviews/{interview_id}/next-question", response_model=InterviewResponse)
async def get_next_question(interview_id: str):
    """Получает следующий вопрос (если интервью не завершено)"""
    try:
        response = api_system.get_next_question(interview_id)
        return InterviewResponse(**response)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/resume-match", response_model=ResumeMatchResponse)
async def match_resume(request: ResumeMatchRequest):
    try:
        vacancy_id = request.vacancy_id
        print(f"📋 vacancy_id: {vacancy_id}")

        # Валидируем ObjectId
        try:
            oid = ObjectId(vacancy_id)
        except Exception:
            raise HTTPException(status_code=400, detail="Некорректный ID вакансии")

        vacancy = vacancies_collection.find_one({'_id': oid})
        print(f"📊 Найдена вакансия: {vacancy is not None}")

        if vacancy is None:
            raise HTTPException(status_code=404, detail="Вакансия не найдена")

        # Безопасные значения по умолчанию
        required_skills = vacancy.get('required_skills') or []
        optional_skills = vacancy.get('optional_skills') or []
        try:
            min_experience = float(vacancy.get('min_experience', 0))
            max_experience = float(vacancy.get('max_experience', 100))
        except Exception:
            min_experience, max_experience = 0.0, 100.0
        education_required = vacancy.get('education_required', '') or ' '

        matcher = FlexibleResumeMatcher(
            required_skills=required_skills,
            optional_skills=optional_skills,
            min_experience=min_experience,
            max_experience=max_experience,
            education_required=education_required,
            weights={
                "required_skills": 0.5,
                "optional_skills": 0.15,
                "experience": 0.25,
                "education": 0.1
            }
        )

        resume_text = request.resume or ""
        if not isinstance(resume_text, str):
            resume_text = str(resume_text)

        result = matcher.evaluate(resume_text)
        return ResumeMatchResponse(**result)
        
    except Exception as e:
        # Если это уже HTTPException - пробрасываем как есть
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=f"Error matching resume: {str(e)}")



@app.get("/")
async def root():
    """Корневой endpoint"""
    return {
        "message": "AI Interview System API",
        "version": "1.0.0",
        "endpoints": {
            "create_interview": "POST /interviews",
            "submit_answer": "POST /interviews/{interview_id}/answer",
            "get_status": "GET /interviews/{interview_id}/status",
            "get_next_question": "GET /interviews/{interview_id}/next-question",
            "match_resume": "POST /resume-match"
        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
