import logging
import random
from typing import Any, Dict, Set

from ..src.prompts import resume_question_prompt

logger = logging.getLogger(__name__)


def get_fallback_question(
    topic: str, current_index: int, asked_questions: Set[str], questions_in_topic: int
) -> Dict[str, Any]:
    neutral_pool = [
        "Расскажите о последней задаче: контекст, цель, что сделали, какой результат?",
        "Как вы проверяете корректность и качество своей работы?",
        "Опишите ваш типичный подход к разбору требований перед началом задачи.",
        "Приведите пример, когда вы улучшили процесс или сократили время выполнения работы.",
        "Как вы выбираете инструменты и подходы для решения задачи и оцениваете их эффективность?",
    ]

    for question in neutral_pool:
        if question not in asked_questions:
            asked_questions.add(question)
            return {
                "current_topic": topic,
                "current_question": {"id": f"fallback_{current_index}", "content": question},
                "asked_question_ids": asked_questions,
                "questions_in_current_topic": questions_in_topic,
            }

    last_question = neutral_pool[-1]
    asked_questions.add(last_question)
    return {
        "current_topic": topic,
        "current_question": {"id": f"fallback_{current_index}", "content": last_question},
        "asked_question_ids": asked_questions,
        "questions_in_current_topic": questions_in_topic,
    }


def get_resume_question(
    state: Dict[str, Any],
    *,
    llm: Any,
    alignment: str,
    max_questions_per_topic: int,
    topic: str,
    current_index: int,
    asked_questions: Set[str],
) -> Dict[str, Any]:
    resume = state.get("resume", "")
    job_description = state.get("job_description", "")
    role = state.get("role", "").strip()
    questions_in_topic = state.get("questions_in_current_topic", 0)

    if questions_in_topic >= max_questions_per_topic:
        return {
            "skip_topic": True,
            "current_topic_index": current_index + 1,
            "questions_in_current_topic": 0,
            "deepening_questions_count": 0,
            "hints_given_count": 0,
        }

    prompt = resume_question_prompt()
    chain = prompt | llm
    try:
        resp = chain.invoke(
            {
                "alignment": alignment,
                "role": role if role else "",
                "resume": resume[:600],
                "job_description": job_description[:600],
                "q_index": questions_in_topic + 1,
            }
        )
        question_content = (resp.content or "").strip()
        if not question_content:
            raise ValueError("LLM вернул пустой вопрос")

        base_id = f"resume_q_{questions_in_topic}"
        question_id = base_id
        suffix = 1
        while question_id in asked_questions:
            question_id = f"{base_id}_{suffix}"
            suffix += 1

        asked_questions.add(question_id)
        logger.info(f"Вопрос по резюме (LLM): '{question_content[:80]}...'")
        return {
            "current_topic": topic,
            "current_question": {"id": question_id, "content": question_content},
            "asked_question_ids": asked_questions,
            "questions_in_current_topic": questions_in_topic,
        }
    except Exception as e:
        logger.exception(f"Ошибка генерации резюме-вопроса LLM: {e}")
        if role.lower() in [
            "ux/ui designer",
            "ux designer",
            "ui/ux designer",
            "дизайнер",
            "ux",
            "ui",
        ]:
            question_content = (
                "Кратко опишите один проект из портфолио: цель, процесс, ваша роль и результат."
            )
        else:
            question_content = (
                "Расскажите о самом важном проекте из резюме и вашей роли в нём."
            )
        question_id = f"resume_q_{questions_in_topic}"
        asked_questions.add(question_id)
        return {
            "current_topic": topic,
            "current_question": {"id": question_id, "content": question_content},
            "asked_question_ids": asked_questions,
            "questions_in_current_topic": questions_in_topic,
        }


def select_next_question(
    state: Dict[str, Any], *, assistant: Any, llm: Any, alignment: str, max_questions_per_topic: int
) -> Dict[str, Any]:
    interview_plan = state.get("interview_plan", {})
    topics = interview_plan.get("topics", [])
    current_topic_index = state.get("current_topic_index", 0)
    asked_questions = state.get("asked_question_ids", set())
    max_total_questions = interview_plan.get("max_total_questions", 20)
    questions_asked = state.get("questions_asked_count", 0)

    if questions_asked >= max_total_questions:
        logger.info(f"Достигнут общий лимит вопросов: {max_total_questions}")
        return {}

    if current_topic_index >= len(topics):
        logger.info(f"Все темы завершены: {current_topic_index}/{len(topics)}")
        return {}

    next_topic = topics[current_topic_index]["name"]
    topic_max_questions = topics[current_topic_index].get("max_questions", 3)
    questions_in_topic = state.get("questions_in_current_topic", 0)

    logger.debug(f"Ищу новые вопросы по теме '{next_topic}'...")
    logger.debug(f"Вопросов в теме: {questions_in_topic}/{topic_max_questions}")
    logger.debug(f"Индекс темы: {current_topic_index}/{len(topics)}")

    if questions_in_topic >= topic_max_questions:
        logger.info(f"Достигнут лимит вопросов в теме '{next_topic}'")
        return {
            "skip_topic": True,
            "current_topic_index": current_topic_index + 1,
            "questions_in_current_topic": 0,
            "deepening_questions_count": 0,
        }

    try:
        if next_topic == "Resume Discussion":
            return get_resume_question(
                state,
                llm=llm,
                alignment=alignment,
                max_questions_per_topic=max_questions_per_topic,
                topic=next_topic,
                current_index=current_topic_index,
                asked_questions=asked_questions,
            )

        questions = assistant.get_questions_for_topic(topic=next_topic, count=5)
        logger.debug(f"Найдено {len(questions)} потенциальных вопросов")

        filtered_questions = []
        for q in questions:
            if isinstance(q, list) and q:
                q = q[0]

            if isinstance(q, dict):
                question_id = None
                question_content = None

                if "metadata" in q and q["metadata"]:
                    question_id = q["metadata"].get("question")
                    question_content = q["metadata"].get("question")
                elif "content" in q:
                    question_content = q["content"]
                    question_id = question_content[:50]

                if question_id and question_id not in asked_questions:
                    filtered_questions.append(q)

        if not filtered_questions:
            logger.warning("Все вопросы уже заданы, разрешаем повтор")
            filtered_questions = questions

        if filtered_questions:
            first_result = random.choice(filtered_questions)

            question_content = None
            question_id = f"rag_q_{current_topic_index}"

            if isinstance(first_result, dict):
                if "metadata" in first_result and first_result["metadata"]:
                    question_content = first_result["metadata"].get("question")
                    question_id = question_content or question_id
                elif "content" in first_result:
                    question_content = first_result["content"]
                    if "Вопрос:" in question_content:
                        question_content = (
                            question_content.split("Вопрос:")[1].split("\n")[0].strip()
                        )

            if question_content and len(question_content.strip()) > 15:
                asked_questions.add(question_id)
                logger.info(f"Новый вопрос выбран: '{question_content[:60]}...'")
                return {
                    "current_topic": next_topic,
                    "current_question": {
                        "id": question_id,
                        "content": question_content,
                    },
                    "asked_question_ids": asked_questions,
                    "questions_in_current_topic": questions_in_topic,
                }

        raise ValueError("Не удалось найти подходящий вопрос")

    except Exception as e:
        logger.warning(f"RAG не сработал ({e}), используем fallback")
        return get_fallback_question(
            next_topic, current_topic_index, asked_questions, questions_in_topic
        )
