from typing import TypedDict, Annotated, List, Dict, Optional, Set, Any
from langgraph.graph import add_messages

class InterviewState(TypedDict):
    """Состояние интервью для LangGraph"""
    resume: str
    job_description: str
    role: Optional[str]

    interview_plan: Optional[Dict]

    current_topic: Optional[str]
    current_question: Optional[Dict]
    last_candidate_answer: Optional[str]

    messages: Annotated[list, add_messages]

    answer_evaluations: List[Dict]

    questions_asked_count: int
    questions_in_current_topic: int
    deepening_questions_count: int
    hints_given_count: int
    current_topic_index: int
    asked_question_ids: Set[str]

    final_recommendation: Optional[str]
    report: Optional[str]

    generated_question: Optional[Dict]
    controller_decision: Optional[str]
    completed_topics: Optional[Set[str]]
    skip_topic: Optional[bool]
    question_type: Optional[str]
    last_question_type: Optional[str]
