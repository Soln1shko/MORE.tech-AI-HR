import os
import argparse
import logging

from ml_system.interview import InterviewSystem

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("cli")


def read_text(path: str) -> str:
    if not path:
        return ""
    with open(path, "r", encoding="utf-8") as f:
        return f.read().strip()


def run_interview(
    *,
    api_key: str,
    resume_text: str,
    job_text: str,
    role: str = "",
    model: str = "mistralai/mistral-7b-instruct:free",
    max_total_questions: int = 10,
    max_questions_per_topic: int = 2,
    load_knowledge_path: str | None = None,
):
    """
    Универсальная точка входа для запуска интервью из кода/ноутбука.

    Args:
        api_key: Ключ OpenRouter (строка, обязательный).
        resume_text: Текст резюме кандидата (строка).
        job_text: Текст описания вакансии (строка).
        role: Роль (например, "ML Engineer").
        model: Идентификатор модели OpenRouter.
        max_total_questions: Общий лимит вопросов.
        max_questions_per_topic: Лимит вопросов на тему.
        load_knowledge_path: Путь к JSON-файлу базы знаний для RAG (опционально).

    Returns:
        (final_state, report, recommendation)
    """
    if not api_key or not isinstance(api_key, str):
        raise ValueError("api_key обязателен для запуска интервью")

    system = InterviewSystem(
        api_key=api_key,
        model=model,
        max_total_questions=max_total_questions,
        max_questions_per_topic=max_questions_per_topic,
    )

    if load_knowledge_path:
        system.load_knowledge(knowledge_file=load_knowledge_path)

    final_state = system.run_interview(
        resume=resume_text,
        job_description=job_text,
        role=role,
    )
    report = system.get_report(final_state)
    recommendation = system.get_recommendation(final_state)
    return final_state, report, recommendation
