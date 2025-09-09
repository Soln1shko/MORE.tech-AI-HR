import logging
from typing import Callable, Dict, Any
from langgraph.graph import StateGraph

from .state import InterviewState

logger = logging.getLogger(__name__)


def build_graph(
    *,
    planner_node: Callable[[Dict[str, Any]], Dict[str, Any]],
    selector_node: Callable[[Dict[str, Any]], Dict[str, Any]],
    conversation_node: Callable[[Dict[str, Any]], Dict[str, Any]],
    evaluator_node: Callable[[Dict[str, Any]], Dict[str, Any]],
    controller_node: Callable[[Dict[str, Any]], Dict[str, Any]],
    reporter_node: Callable[[Dict[str, Any]], Dict[str, Any]],
    router_func: Callable[[Dict[str, Any]], str],
):
    """Строит и компилирует граф интервью и возвращает app."""
    logger.info("Построение графа интервью (workflow.py)...")

    workflow = StateGraph(InterviewState)

    workflow.add_node("planner", planner_node)
    workflow.add_node("selector", selector_node)
    workflow.add_node("conversation_manager", conversation_node)
    workflow.add_node("evaluator", evaluator_node)
    workflow.add_node("controller", controller_node)
    workflow.add_node("reporter", reporter_node)

    workflow.set_entry_point("planner")
    workflow.add_edge("planner", "selector")
    workflow.add_edge("selector", "conversation_manager")
    workflow.add_edge("conversation_manager", "evaluator")
    workflow.add_edge("evaluator", "controller")

    workflow.add_conditional_edges(
        "controller",
        router_func,
        {
            "selector": "selector",
            "conversation_manager": "conversation_manager",
            "reporter": "reporter",
        },
    )
    workflow.add_edge("reporter", "__end__")

    app = workflow.compile()
    logger.info("Граф построен и скомпилирован (workflow.py)")
    return app
