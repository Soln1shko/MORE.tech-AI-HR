import logging
from typing import Any, Dict, List

from ..src.prompts import report_prompt

logger = logging.getLogger(__name__)


def _build_topics_summary(evaluations: List[Dict]) -> str:
    parts = []
    for ev in evaluations:
        topic = ev.get("topic", "Unknown")
        score = ev.get("score_percent", 0)
        detailed = ev.get("detailed_scores", {})
        part = [
            f"• Тема: {topic}",
            f"  - Итоговая оценка: {score:.1f}%",
        ]
        if detailed:
            part.extend(
                [
                    f"  - Техническая точность: {detailed.get('technical_accuracy', 'N/A')}/10",
                    f"  - Глубина знаний: {detailed.get('depth_of_knowledge', 'N/A')}/10",
                    f"  - Практический опыт: {detailed.get('practical_experience', 'N/A')}/10",
                    f"  - Коммуникация: {detailed.get('communication_clarity', 'N/A')}/10",
                ]
            )
        parts.append("\n".join(part))
    return "\n".join(parts)


def generate_report(state: Dict[str, Any], *, llm: Any) -> Dict[str, Any]:
    """Генерирует финальный отчёт по интервью и рекомендацию.
    Возвращает {"report": str, "final_recommendation": str, "llm_analysis": dict?}
    """
    logger.debug("--- Агент: Генератор отчетов ---")

    evaluations = state.get("answer_evaluations", [])
    if not evaluations:
        return {"report": "Отчет не может быть создан: нет оценок."}

    topics_summary = _build_topics_summary(evaluations)
    avg_score = sum(ev.get("score_percent", 0) for ev in evaluations) / max(
        1, len(evaluations)
    )

    all_inconsistencies = []
    all_red_flags = []
    all_strengths = []
    all_weaknesses = []
    for ev in evaluations:
        analysis = ev.get("analysis", {})
        all_inconsistencies.extend(analysis.get("inconsistencies", []))
        all_red_flags.extend(analysis.get("red_flags", []))
        all_strengths.extend(analysis.get("strengths", []))
        all_weaknesses.extend(analysis.get("weaknesses", []))

    prompt = report_prompt()
    try:
        chain = prompt | llm
        response = chain.invoke(
            {
                "resume": state.get("resume", "")[:500],
                "job_description": state.get("job_description", "")[:300],
                "topics_summary": topics_summary,
                "avg_score": avg_score,
                "inconsistencies": all_inconsistencies[:10],
                "red_flags": all_red_flags[:10],
                "strengths": list(set(all_strengths))[:10],
                "weaknesses": list(set(all_weaknesses))[:10],
            }
        )
        report_text = getattr(response, "content", "").strip()
    except Exception:
        logger.exception("Ошибка LLM в генераторе отчетов, используем базовый шаблон")
        recommendation = (
            "HIRE" if avg_score >= 80 else "MAYBE" if avg_score >= 65 else "REJECT"
        )
        base = [
            "ОТЧЕТ ПО ИНТЕРВЬЮ",
            f"ОБЩАЯ ОЦЕНКА: {avg_score:.1f}%",
            f"РЕШЕНИЕ: {recommendation}",
            "",
            topics_summary,
        ]
        return {
            "report": "\n".join(base),
            "final_recommendation": recommendation,
        }

    recommendation = "MAYBE"
    if "HIRE" in report_text:
        recommendation = "HIRE"
    if "REJECT" in report_text:
        recommendation = "REJECT"

    return {
        "report": report_text,
        "final_recommendation": recommendation,
    }
