"""
Пакет для модульной версии Interview System.
Пока содержит только заглушку и экспортирует основной класс из старого модуля
для обратной совместимости. В следующих шагах планируется поэтапный перенос
классов и агентов в подмодули (state, controller, planner, selector и т.д.).
"""
from ml_system.interview.interview_system import InterviewSystem

__all__ = ["InterviewSystem"]
