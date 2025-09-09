import json
import logging
import re
from typing import Any, Dict

from langchain_core.prompts import ChatPromptTemplate

from ..src.utils import strip_md_fences

logger = logging.getLogger(__name__)


def plan_interview(
    state: Dict[str, Any],
    *,
    llm: Any,
    alignment: str,
    max_total_questions: int,
    max_questions_per_topic: int,
) -> Dict[str, Any]:
    """Планировщик интервью: формирует interview_plan.
    Возвращает словарь {"interview_plan": plan}.
    """
    logger.debug("--- Агент: Планировщик ---")

    resume = state.get("resume", "")
    job_desc = state.get("job_description", "")
    role = state.get("role", "")

    planning_prompt = ChatPromptTemplate.from_template(
        """
        Ты — опытный технический интервьюер. Сформируй персонализированный план собеседования.
        
        Политика выравнивания:\n
        {alignment}

        Роль: {role}
        Резюме кандидата: {resume}
        Описание вакансии: {job_description}
        
        Требования к плану:
        1. Начать с обсуждения резюме и прошлого опыта (Resume Discussion)
        2. Включить темы, строго релевантные описанию вакансии и содержимому резюме (не добавляй несоответствующие темы).
        3. Структурировать от общих тем к более специфическим аспектам компетенций.
        4. Покрыть HARD и SOFT аспекты.
        5. Нейтральные формулировки (без уровней/должностей). Без Markdown.
        
        Верни ТОЛЬКО валидный JSON:
        {{"topics": [{{"name": str, "description": str}}, ...], "interview_style": "conversational"}}
        """
    )

    try:
        planning_chain = planning_prompt | llm
        response = planning_chain.invoke(
            {
                "alignment": alignment,
                "role": role[:100],
                "resume": resume[:400],
                "job_description": job_desc[:400],
            }
        )
    except Exception as e:
        logger.exception(f"Ошибка LLM в планировщике: {e}")
        logger.warning("Используем нейтральный резервный план")
        fallback_plan = {
            "topics": [
                {"name": "Resume Discussion", "description": "Обсуждение опыта и проектов из резюме", "max_questions": 1},
                {"name": "Problem Solving", "description": "Подходы к решению задач и анализу требований", "max_questions": 1},
                {"name": "Tools and Practices", "description": "Инструменты, процессы и практики качества", "max_questions": 1},
                {"name": "Data Handling", "description": "Работа с данными, форматами и проверками", "max_questions": 1},
                {"name": "Collaboration", "description": "Взаимодействие, коммуникация, договоренности", "max_questions": 1},
                {"name": "Reliability & Testing", "description": "Надежность, тестирование и контроль изменений", "max_questions": 1},
                {"name": "Delivery", "description": "Планирование, сроки, итерации и выпуск", "max_questions": 1},
                {"name": "Learning & Growth", "description": "Самообучение, обратная связь и развитие", "max_questions": 1},
            ],
            "max_total_questions": max_total_questions,
            "interview_style": "conversational",
        }
        return {"interview_plan": fallback_plan}

    content = response.content
    if isinstance(content, list):
        content = "".join(str(item) for item in content)
    content = strip_md_fences(content)

    try:
        if "{" in content:
            start = content.find("{")
            end = content.rfind("}") + 1
            content = content[start:end]
        plan = json.loads(content)

        if not isinstance(plan, dict) or "topics" not in plan:
            raise ValueError("Неверная структура плана")

        for topic in plan["topics"]:
            topic["max_questions"] = max_questions_per_topic
        plan["max_total_questions"] = max_total_questions

        logger.info(f"План создан: {len(plan['topics'])} тем")
        return {"interview_plan": plan}

    except Exception as e:
        logger.exception(f"Ошибка создания плана: {e}")
        fallback_plan = {
            "topics": [
                {"name": "Resume Discussion", "description": "Обсуждение опыта и проектов из резюме", "max_questions": max_questions_per_topic},
                {"name": "Problem Solving", "description": "Подходы к решению задач и анализу требований", "max_questions": max_questions_per_topic},
                {"name": "Tools and Practices", "description": "Инструменты, процессы и практики качества", "max_questions": max_questions_per_topic},
                {"name": "Data Handling", "description": "Работа с данными, форматами и проверками", "max_questions": max_questions_per_topic},
                {"name": "Collaboration", "description": "Взаимодействие, коммуникация, договоренности", "max_questions": max_questions_per_topic},
                {"name": "Reliability & Testing", "description": "Надежность, тестирование и контроль изменений", "max_questions": max_questions_per_topic},
                {"name": "Delivery", "description": "Планирование, сроки, итерации и выпуск", "max_questions": max_questions_per_topic},
                {"name": "Learning & Growth", "description": "Самообучение, обратная связь и развитие", "max_questions": max_questions_per_topic},
            ],
            "max_total_questions": max_total_questions,
            "interview_style": "conversational",
        }
        logger.warning("Используется нейтральный план по умолчанию: 8 тем")
        return {"interview_plan": fallback_plan}
