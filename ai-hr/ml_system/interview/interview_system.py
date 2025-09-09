"""
Агентная система для проведения технических интервью
Переписана в виде класса для лучшей организации кода
"""

# from langchain_core.messages import HumanMessage, AIMessage  # перенесено в conversation.py
# from langchain_core.prompts import ChatPromptTemplate        # промпты вынесены в prompts.py
from langchain_openai import ChatOpenAI
import json
import logging
from typing import Dict, Optional, Set, Any
from ml_system.retrieva import InterviewKnowledgeSystemHF, InterviewAssistantHF
from ml_system.interview.state import InterviewState
from ml_system.interview.agents.controller import AdaptiveInterviewControllerAgent
from ml_system.interview.src.config import InterviewConfig
from ml_system.interview.agents.planner import plan_interview
from ml_system.interview.agents.selector import get_fallback_question, get_resume_question, select_next_question
from ml_system.interview.agents.conversation import conversation_turn
from ml_system.interview.agents.evaluator import evaluate_answer
from ml_system.interview.agents.reporter import generate_report
from ml_system.interview.workflow import build_graph

logger = logging.getLogger(__name__)

class InterviewSystem:
    """Основной класс агентной системы интервью"""
    
    def __init__(self, 
                 api_key: str, 
                 model: str = "mistralai/mistral-7b-instruct:free",
                 max_total_questions: int = 10,
                 max_questions_per_topic: int = 2,
                 collection_name: str = "interview_questions_hf",
                 config: InterviewConfig | None = None):
        """
        Инициализация системы интервью
        
        Args:
            api_key: API ключ для OpenRouter
            model: Модель LLM для использования
            max_total_questions: Максимальное общее количество вопросов
            max_questions_per_topic: Максимальное количество вопросов в одной теме
        """
        if not api_key or "your" in api_key.lower() or len(api_key) < 10:
            raise ValueError("❌ Неверный API ключ. Пожалуйста, укажите корректный API ключ OpenRouter.")
        
        api_key = api_key.strip()
        if len(api_key) > 200:
            logger.warning("API ключ кажется слишком длинным, обрезаем")
            api_key = api_key[:200]
        
        self.api_key = api_key
        self.config = config or InterviewConfig(
            model=model,
            max_total_questions=max_total_questions,
            max_questions_per_topic=max_questions_per_topic,
            collection_name=collection_name,
        )
        self.model = self.config.model
        self.max_total_questions = self.config.max_total_questions
        self.max_questions_per_topic = self.config.max_questions_per_topic
        self.collection_name = self.config.collection_name
        
        try:
            self.llm = ChatOpenAI(
                model=self.config.model,
                temperature=self.config.temperature,
                api_key=api_key,
                base_url=self.config.base_url,
                model_kwargs={"extra_headers": {"HTTP-Referer": "http://localhost"}}
            )
            logger.info("LLM успешно инициализирован")
        except Exception as e:
            logger.exception(f"Ошибка инициализации LLM: {e}")
            logger.debug("Попробуйте проверить API ключ или использовать другую модель")
            raise
        
        self.knowledge_system = InterviewKnowledgeSystemHF(collection_name=self.collection_name)
        self.assistant = InterviewAssistantHF(knowledge_system=self.knowledge_system)
        
        self.alignment = self.config.alignment
        
        self.adaptive_controller = AdaptiveInterviewControllerAgent(
            self.llm,
            max_poor_answers=self.config.max_poor_answers,
            max_medium_answers=self.config.max_medium_answers,
            max_deepening_questions=self.config.max_deepening_questions,
            max_hints=self.config.max_hints,
            alignment=self.alignment,
        )
        
        self.workflow = None
        self.app = None
        
        logger.info("Система интервью инициализирована")
    
    def _interview_planner(self, state: InterviewState) -> Dict[str, Any]:
        """Планировщик интервью (обёртка)."""
        return plan_interview(
            state,
            llm=self.llm,
            alignment=self.alignment,
            max_total_questions=self.max_total_questions,
            max_questions_per_topic=self.max_questions_per_topic,
        )
    
    def _question_selector(self, state: InterviewState) -> Dict[str, Any]:
        """Селектор вопросов (обёртка)."""
        return select_next_question(
            state,
            assistant=self.assistant,
            llm=self.llm,
            alignment=self.alignment,
            max_questions_per_topic=self.max_questions_per_topic,
        )
    
    def _get_resume_questions(self, state: Dict[str, Any], topic: str, current_index: int, asked_questions: Set[str]) -> Dict[str, Any]:
        """Обёртка для совместимости: делегирует логику в selector.get_resume_question."""
        return get_resume_question(
            state,
            llm=self.llm,
            alignment=self.alignment,
            max_questions_per_topic=self.max_questions_per_topic,
            topic=topic,
            current_index=current_index,
            asked_questions=asked_questions,
        )
    
    def _get_fallback_question(self, topic: str, current_index: int, asked_questions: Set[str], questions_in_topic: int) -> Dict[str, Any]:
        """Обёртка для совместимости: делегирует логику в selector.get_fallback_question."""
        return get_fallback_question(topic, current_index, asked_questions, questions_in_topic)
    
    def _conversation_manager(self, state: InterviewState) -> Dict[str, Any]:
        """Менеджер диалога (обёртка)."""
        return conversation_turn(state)
    
    def _answer_evaluator(self, state: InterviewState) -> Dict[str, Any]:
        """Оценщик ответов (обёртка)."""
        return evaluate_answer(state, llm=self.llm, alignment=self.alignment)

    def _report_generator(self, state: InterviewState) -> Dict[str, Any]:
        """Генератор отчётов (обёртка)."""
        return generate_report(state, llm=self.llm)
    
    def _router(self, state: InterviewState) -> str:
        """Роутер шага графа: выбирает следующий узел на основании состояния."""
        logger.debug("--- Роутер ---")
        
        controller_decision = state.get("controller_decision")
        generated_question = state.get("generated_question")
        skip_topic = state.get("skip_topic", False)
        
        logger.debug(f"Решение контроллера: {controller_decision}")
        logger.debug(f"Есть сгенерированный вопрос: {bool(generated_question)}")
        logger.debug(f"Пропустить тему: {skip_topic}")
        
        interview_plan = state.get("interview_plan", {})
        max_total_questions = interview_plan.get("max_total_questions", 20)
        questions_asked = state.get("questions_asked_count", 0)
        topics = interview_plan.get("topics", [])
        current_topic_index = state.get("current_topic_index", 0)
        
        deepening_count = state.get("deepening_questions_count", 0)
        hints_count = state.get("hints_given_count", 0)
        max_deepening = self.adaptive_controller.max_deepening_questions
        max_hints = self.adaptive_controller.max_hints
        logger.debug(f"Вопросов задано: {questions_asked}/{max_total_questions}")
        logger.debug(f"Текущая тема: {current_topic_index}/{len(topics)}")
        logger.debug(f"Уточняющих вопросов: {deepening_count}/{max_deepening}")
        logger.debug(f"Подсказок дано: {hints_count}/{max_hints}")
        logger.debug("ОТЛАДКА СЧЕТЧИКОВ В РОУТЕРЕ:")
        logger.debug(f" - questions_asked_count: {questions_asked}")
        logger.debug(f" - deepening_questions_count: {deepening_count}")
        logger.debug(f" - hints_given_count: {hints_count}")
        
        if questions_asked >= max_total_questions:
            logger.info("Достигнут общий лимит вопросов")
            return "reporter"
        
        if current_topic_index >= len(topics):
            logger.info("Все темы завершены")
            return "reporter"
        
        if questions_asked > 0 and questions_asked % 10 == 0:
            logger.warning(f"Предупреждение: задано {questions_asked} вопросов, проверяем состояние...")
            if questions_asked >= 25:
                logger.error("Аварийное завершение - слишком много вопросов")
                return "reporter"
        
        if controller_decision == "continue_topic" and generated_question:
            logger.debug("Используем сгенерированный контроллером вопрос")
            return "conversation_manager"
        elif controller_decision == "skip_topic" or skip_topic:
            logger.info("Пропускаем тему")
            return "selector"
        elif controller_decision == "continue_standard":
            logger.debug("Продолжаем стандартный поток к следующей теме")
            return "selector"
        
        logger.debug("Стандартная логика - к следующей теме")
        return "selector"
    
    def _adaptive_controller_node(self, state: InterviewState) -> Dict[str, Any]:
        """Обёртка для вызова адаптивного контроллера."""
        return self.adaptive_controller.execute(state)
    
    def build_workflow(self) -> None:
        """Построение графа интервью (через workflow.build_graph)."""
        self.app = build_graph(
            planner_node=self._interview_planner,
            selector_node=self._question_selector,
            conversation_node=self._conversation_manager,
            evaluator_node=self._answer_evaluator,
            controller_node=self._adaptive_controller_node,
            reporter_node=self._report_generator,
            router_func=self._router,
        )
    
    def load_knowledge(self, knowledge_file: Optional[str] = None, knowledge_json: Optional[Dict[str, Any]] = None) -> None:
        """Загрузка базы знаний в RAG-хранилище."""
        try:
            if knowledge_file is not None:
                with open(knowledge_file, 'r', encoding='utf-8') as f:
                    knowledge_chunks = json.load(f)
            else:
                knowledge_chunks = knowledge_json
            self.knowledge_system.add_knowledge_to_rag(knowledge_chunks)
            logger.info(f"База знаний загружена из {knowledge_file}")
        except FileNotFoundError:
            logger.warning(f"Файл {knowledge_file} не найден. RAG-система будет пуста.")
            self.knowledge_system.add_knowledge_to_rag([{
                "section": "Python", 
                "question": "Разница list/tuple", 
                "grade": "middle",
                "answers": {
                    "expected_answer": "...", 
                    "junior_level": "...", 
                    "middle_level": "...", 
                    "senior_level": "...", 
                    "red_flags": [], 
                    "follow_up_questions": []
                }
            }])
    
    def run_interview(self, resume: str, job_description: str, role: str = "") -> Dict[str, Any]:
        """
        Запуск интервью
        
        Args:
            resume: Резюме кандидата
            job_description: Описание вакансии
            role: Целевая роль (например, "UX/UI Designer", "ML Engineer")
            
        Returns:
            Финальное состояние интервью
        """
        if not self.app:
            self.build_workflow()
        
        initial_state = {
            "resume": resume,
            "job_description": job_description,
            "role": role,
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
        
        logger.info("Запуск агентной системы интервью")
        
        config = {"recursion_limit": 50}
        final_state = self.app.invoke(initial_state, config=config)
        
        logger.info("Интервью завершено")
        return final_state
    
    def get_report(self, final_state: Dict[str, Any]) -> str:
        """Получение отчёта из финального состояния."""
        return final_state.get("report", "Отчет не найден")
    
    def get_recommendation(self, final_state: Dict[str, Any]) -> str:
        """Получение рекомендации из финального состояния."""
        return final_state.get("final_recommendation", "UNKNOWN")
