import logging
from typing import Any, Dict
from langchain_core.messages import HumanMessage, AIMessage

logger = logging.getLogger(__name__)


def default_input_provider(prompt: str) -> str:
    return input(prompt)


def conversation_turn(state: Dict[str, Any], *, input_provider=default_input_provider) -> Dict[str, Any]:
    """Менеджер диалога: задаёт вопрос и обрабатывает ответ кандидата."""
    logger.debug("--- Агент: Менеджер диалога ---")

    generated_question = state.get("generated_question")
    current_question = state.get("current_question")

    if generated_question and generated_question.get("content"):
        question_content = generated_question["content"]
        question_id = generated_question.get(
            "id", f"generated_{state.get('questions_asked_count', 0)}"
        )
        logger.debug("Используем сгенерированный контроллером вопрос")
    else:
        question_content = current_question.get("content", "Вопрос не найден")
        question_id = current_question.get("id", "current_question")
        logger.debug("Используем вопрос из селектора")

    logger.info(f"Вопрос: {question_content}")
    answer = input_provider("Ваш ответ: ")

    asked_ids = state.get("asked_question_ids", set())
    asked_ids.add(question_id)

    question_type = state.get("question_type", "")

    if not question_type and generated_question:
        txt = generated_question.get("content", "").lower()
        if "важно обратить внимание" in txt:
            question_type = "hint"
        elif "углубленный" in txt or "детализированный" in txt:
            question_type = "deepening"
        else:
            question_type = "generated"

    if question_type == "deepening":
        new_deepening = state.get("deepening_questions_count", 0) + 1
        new_questions = state.get("questions_asked_count", 0) + 1
        new_topic_questions = state.get("questions_in_current_topic", 0) + 1
        return {
            "current_question": {"id": question_id, "content": question_content},
            "messages": [AIMessage(content=question_content), HumanMessage(content=answer)],
            "last_candidate_answer": answer,
            "questions_asked_count": new_questions,
            "questions_in_current_topic": new_topic_questions,
            "deepening_questions_count": new_deepening,
            "hints_given_count": state.get("hints_given_count", 0),
            "generated_question": None,
            "controller_decision": None,
            "question_type": None,
            "last_question_type": "deepening",
            "asked_question_ids": asked_ids,
        }
    elif question_type == "hint":
        new_hints = state.get("hints_given_count", 0) + 1
        new_questions = state.get("questions_asked_count", 0) + 1
        new_topic_questions = state.get("questions_in_current_topic", 0) + 1
        return {
            "current_question": {"id": question_id, "content": question_content},
            "messages": [AIMessage(content=question_content), HumanMessage(content=answer)],
            "last_candidate_answer": answer,
            "questions_asked_count": new_questions,
            "questions_in_current_topic": new_topic_questions,
            "deepening_questions_count": state.get("deepening_questions_count", 0),
            "hints_given_count": new_hints,
            "generated_question": None,
            "controller_decision": None,
            "question_type": None,
            "last_question_type": "hint",
            "asked_question_ids": asked_ids,
        }
    else:
        new_questions = state.get("questions_asked_count", 0) + 1
        new_topic_questions = state.get("questions_in_current_topic", 0) + 1
        logger.info(
            f"  📊 Обычный вопрос - увеличиваем questions_asked_count -> {new_questions} и questions_in_current_topic -> {new_topic_questions}"
        )
        return {
            "current_question": {"id": question_id, "content": question_content},
            "messages": [AIMessage(content=question_content), HumanMessage(content=answer)],
            "last_candidate_answer": answer,
            "questions_asked_count": new_questions,
            "questions_in_current_topic": new_topic_questions,
            "deepening_questions_count": state.get("deepening_questions_count", 0),
            "hints_given_count": state.get("hints_given_count", 0),
            "generated_question": None,
            "controller_decision": None,
            "question_type": None,
            "last_question_type": "normal",
            "asked_question_ids": asked_ids,
        }
