import logging
from typing import Any, Dict

from ..src.prompts import evaluator_prompt
from ..src.utils import parse_llm_json, safe_truncate

logger = logging.getLogger(__name__)


def evaluate_answer(state: Dict[str, Any], *, llm: Any, alignment: str) -> Dict[str, Any]:
    """Оценщик ответов: возвращает {"answer_evaluations": [...]} (добавляет новую оценку)."""
    logger.debug("--- Агент: Оценщик ответов ---")

    current_question = state.get("current_question", {})
    question = current_question.get("content", "")
    answer = state.get("last_candidate_answer", "")

    prompt = evaluator_prompt()
    try:
        chain = prompt | llm
        response_content = chain.invoke(
            {
                "alignment": alignment,
                "role": state.get("role", ""),
                "topic": state.get("current_topic", ""),
                "question": question,
                "answer": answer,
            }
        ).content
    except Exception as e:
        logger.exception(f"Ошибка LLM в оценщике: {e}")
        return _fallback_evaluation(state, question, answer)

    logger.debug(f"Сырой ответ LLM (первые 100 симв.): {safe_truncate(response_content, 100)}...")

    try:
        scores = parse_llm_json(response_content)
        tech_score = int(max(0, min(10, scores.get("technical_accuracy", 5))))
        depth_score = int(max(0, min(10, scores.get("depth_of_knowledge", 5))))
        practical_score = int(max(0, min(10, scores.get("practical_experience", 5))))
        comm_score = int(max(0, min(10, scores.get("communication_clarity", 5))))
        problem_score = int(max(0, min(10, scores.get("problem_solving_approach", 5))))
        examples_score = int(max(0, min(10, scores.get("examples_and_use_cases", 5))))
    except Exception as e:
        logger.exception(f"Ошибка парсинга JSON из ответа LLM: {e}")
        return _fallback_evaluation(state, question, answer)

    weights = {
        "technical_accuracy": 0.25,
        "depth_of_knowledge": 0.20,
        "practical_experience": 0.20,
        "communication_clarity": 0.15,
        "problem_solving": 0.10,
        "examples_quality": 0.10,
    }

    final_score_percent = (
        tech_score * 10 * weights["technical_accuracy"]
        + depth_score * 10 * weights["depth_of_knowledge"]
        + practical_score * 10 * weights["practical_experience"]
        + comm_score * 10 * weights["communication_clarity"]
        + problem_score * 10 * weights["problem_solving"]
        + examples_score * 10 * weights["examples_quality"]
    )

    evaluation = {
        "topic": state.get("current_topic", "Unknown"),
        "score_percent": final_score_percent,
        "detailed_scores": {
            "technical_accuracy": tech_score,
            "depth_of_knowledge": depth_score,
            "practical_experience": practical_score,
            "communication_clarity": comm_score,
            "problem_solving_approach": problem_score,
            "examples_and_use_cases": examples_score,
        },
        "analysis": {
            "inconsistencies": scores.get("inconsistencies", []),
            "red_flags": scores.get("red_flags", []),
            "strengths": scores.get("strengths", []),
            "weaknesses": scores.get("weaknesses", []),
            "follow_up_suggestions": scores.get("follow_up_suggestions", []),
        },
        "question": question,
        "answer": answer,
    }

    logger.info(
        f"  - 📈 Итоговая оценка темы '{evaluation['topic']}': {final_score_percent:.1f}%"
    )

    evaluations = state.get("answer_evaluations", []) + [evaluation]
    return {"answer_evaluations": evaluations}


def _fallback_evaluation(state: Dict[str, Any], question: str, answer: str) -> Dict[str, Any]:
    tech_score = 3
    depth_score = 3
    practical_score = 2
    comm_score = 4
    problem_score = 3
    examples_score = 2

    weights = {
        "technical_accuracy": 0.25,
        "depth_of_knowledge": 0.20,
        "practical_experience": 0.20,
        "communication_clarity": 0.15,
        "problem_solving": 0.10,
        "examples_quality": 0.10,
    }

    final_score_percent = (
        tech_score * 10 * weights["technical_accuracy"]
        + depth_score * 10 * weights["depth_of_knowledge"]
        + practical_score * 10 * weights["practical_experience"]
        + comm_score * 10 * weights["communication_clarity"]
        + problem_score * 10 * weights["problem_solving"]
        + examples_score * 10 * weights["examples_quality"]
    )

    evaluation = {
        "topic": state.get("current_topic", "Unknown"),
        "score_percent": final_score_percent,
        "detailed_scores": {
            "technical_accuracy": tech_score,
            "depth_of_knowledge": depth_score,
            "practical_experience": practical_score,
            "communication_clarity": comm_score,
            "problem_solving_approach": problem_score,
            "examples_and_use_cases": examples_score,
        },
        "analysis": {
            "inconsistencies": [],
            "red_flags": [],
            "strengths": ["Участвовал в интервью"],
            "weaknesses": ["Требуется дополнительная оценка"],
            "follow_up_suggestions": [],
        },
        "question": question,
        "answer": answer,
    }

    logger.info(
        f"Fallback оценка темы '{evaluation['topic']}': {final_score_percent:.1f}%"
    )

    evaluations = state.get("answer_evaluations", []) + [evaluation]
    return {"answer_evaluations": evaluations}
