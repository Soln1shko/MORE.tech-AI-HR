import logging
from typing import List, Dict, Any, Optional

from langchain_core.prompts import ChatPromptTemplate

logger = logging.getLogger(__name__)


class AdaptiveInterviewControllerAgent:
    """
    Адаптивный контроллер, управляющий ходом интервью на основе качества ответов.

    Анализирует недавние оценки по текущей теме, лимиты уточнений/подсказок и
    формирует решение: углубить тему, задать вопрос того же уровня, дать
    подсказку или перейти к следующей теме. Также генерирует вопросы через LLM
    для различных сценариев ("harder", "deepening", "same_level", "hint").
    """

    def __init__(
        self,
        llm: Any,
        max_poor_answers: int = 2,
        max_good_answers: int = 2,
        max_medium_answers: int = 3,
        max_deepening_questions: int = 1,
        max_hints: int = 1,
        alignment: str = "",
    ) -> None:
        """
        Инициализирует контроллер с параметрами адаптации сложности и лимитами.

        Args:
            llm: Экземпляр чат-модели, совместимый с LangChain (ChatOpenAI и др.).
            max_poor_answers: Порог подряд идущих слабых ответов для пропуска темы.
            max_good_answers: Порог подряд идущих хороших ответов для пропуска темы.
            max_medium_answers: Порог подряд идущих средних ответов для пропуска темы.
            max_deepening_questions: Максимум уточняющих вопросов подряд.
            max_hints: Максимум подсказок подряд.
            alignment: Унифицированная политика выравнивания для промптов LLM.
        """
        self.llm = llm
        self.max_poor_answers = max_poor_answers
        self.max_good_answers = max_good_answers
        self.max_medium_answers = max_medium_answers
        self.max_deepening_questions = max_deepening_questions
        self.max_hints = max_hints
        self.alignment = alignment

    def execute(self, state: Dict[str, Any]) -> Dict[str, Any]:
        logger.debug("--- Агент: Адаптивный контроллер интервью ---")
        decision = self.analyze_and_decide(state)
        return self.execute_decision(state, decision)

    def analyze_and_decide(self, state: Dict[str, Any]) -> Dict[str, Any]:
        recent_scores = self._get_topic_scores(state)
        last_evaluation = self._get_last_evaluation(state)

        if not recent_scores:
            return {"action": "continue", "reason": "Первый вопрос по теме"}

        poor_streak = self._count_poor_streak(recent_scores)
        good_streak = self._count_good_streak(recent_scores)
        medium_streak = self._count_medium_streak(recent_scores)
        last_score = recent_scores[-1]

        logger.debug(f"Последние оценки: {recent_scores}")
        logger.debug(
            f"Серии подряд — плохие: {poor_streak}, хорошие: {good_streak}, средние: {medium_streak}"
        )

        questions_in_topic = state.get("questions_in_current_topic", 0)
        interview_plan = state.get("interview_plan", {})
        topics = interview_plan.get("topics", [])
        current_topic_index = state.get("current_topic_index", 0)
        if current_topic_index < len(topics):
            current_topic_obj = (
                topics[current_topic_index] if isinstance(topics[current_topic_index], dict) else {}
            )
            topic_max_questions = current_topic_obj.get("max_questions")
            if not isinstance(topic_max_questions, int) or topic_max_questions <= 0:
                topic_max_questions = 2
            if questions_in_topic >= topic_max_questions:
                logger.info(
                    f"Достигнут лимит вопросов в теме ({questions_in_topic}/{topic_max_questions})"
                )
                return {
                    "action": "skip_topic",
                    "reason": f"Достигнут лимит вопросов в теме ({questions_in_topic}/{topic_max_questions})",
                }

        deepening_count = state.get("deepening_questions_count", 0)
        if deepening_count >= self.max_deepening_questions:
            logger.info(
                f"Достигнут лимит уточняющих вопросов ({deepening_count}/{self.max_deepening_questions}), сбрасываем счетчик и задаем новый вопрос"
            )
            return {
                "action": "same_level_question",
                "reason": f"Достигнут лимит уточняющих вопросов ({deepening_count}/{self.max_deepening_questions}), сбрасываем счетчик",
                "deepening_questions_count": 0,
            }

        hints_count = state.get("hints_given_count", 0)
        if hints_count >= self.max_hints:
            logger.info(
                f"Достигнут лимит подсказок ({hints_count}/{self.max_hints}), сбрасываем счетчик и задаем новый вопрос"
            )
            return {
                "action": "same_level_question",
                "reason": f"Достигнут лимит подсказок ({hints_count}/{self.max_hints}), сбрасываем счетчик",
                "hints_given_count": 0,
            }

        if last_evaluation and self._is_unknown_response(last_evaluation):
            hints_count = state.get("hints_given_count", 0)
            if hints_count < self.max_hints:
                logger.debug(
                    f"LLM зафиксировал 'не знаю' — даем направляющий вопрос ({hints_count + 1}/{self.max_hints})"
                )
                return {
                    "action": "provide_hint",
                    "reason": "LLM отметил отсутствие ответа/неуверенность кандидата",
                }
            else:
                logger.info(
                    "LLM зафиксировал 'не знаю', но лимит подсказок исчерпан — задаем вопрос того же уровня"
                )
                return {"action": "same_level_question", "reason": "Лимит подсказок исчерпан"}

        if last_evaluation:
            inconsistencies = last_evaluation.get("analysis", {}).get("inconsistencies", [])
            red_flags = last_evaluation.get("analysis", {}).get("red_flags", [])

            if inconsistencies or red_flags:
                return {
                    "action": "deepen_topic",
                    "reason": f"Найдены несостыковки/красные флаги: {inconsistencies + red_flags}",
                }

        if poor_streak >= self.max_poor_answers:
            return {"action": "skip_topic", "reason": f"{poor_streak} плохих ответов подряд"}
        elif good_streak >= self.max_good_answers:
            return {"action": "skip_topic", "reason": f"{good_streak} хороших ответов подряд"}
        elif medium_streak >= self.max_medium_answers:
            return {"action": "skip_topic", "reason": f"{medium_streak} средних ответов подряд"}

        if last_score >= 70:
            return {"action": "deepen_topic", "reason": f"Хороший результат ({last_score}%) - продолжаем тему"}
        elif last_score >= 40:
            return {
                "action": "same_level_question",
                "reason": f"Средний результат ({last_score}%) - задаем вопрос того же уровня",
            }
        else:
            return {
                "action": "provide_hint",
                "reason": f"Слабый результат ({last_score}%) - даем подсказку",
            }

    def execute_decision(self, state: Dict[str, Any], decision: Dict[str, Any]) -> Dict[str, Any]:
        action = decision["action"]
        reason = decision["reason"]

        logger.debug(f"Решение контроллера: {action} - {reason}")

        if action == "skip_topic":
            return self._skip_topic(state)
        elif action == "increase_difficulty":
            result = self._generate_harder_question(state)
            logger.debug(f"Возвращаем question_type: {result.get('question_type', 'НЕ НАЙДЕН')}")
            return result
        elif action == "deepen_topic":
            result = self._generate_deeper_question(state)
            logger.debug(f"Возвращаем question_type: {result.get('question_type', 'НЕ НАЙДЕН')}")
            return result
        elif action == "provide_hint":
            result = self._provide_hint_and_question(state)
            logger.debug(f"Возвращаем question_type: {result.get('question_type', 'НЕ НАЙДЕН')}")
            return result
        elif action == "same_level_question":
            result = self._generate_same_level_question(state)
            logger.debug(f"Возвращаем question_type: {result.get('question_type', 'НЕ НАЙДЕН')}")
            return result
        else:
            return self._continue_standard_flow(state)

    def _get_topic_scores(self, state: Dict[str, Any]) -> List[float]:
        current_topic = state.get("current_topic")
        evaluations = state.get("answer_evaluations", [])

        scores = []
        for eval_item in evaluations:
            if eval_item.get("topic") == current_topic:
                scores.append(eval_item.get("score_percent", 0))

        return scores

    def _count_poor_streak(self, scores: List[float]) -> int:
        streak = 0
        for score in reversed(scores):
            if score < 40:
                streak += 1
            else:
                break
        logger.debug(
            f"Подсчет плохих ответов: {scores[-5:] if len(scores) >= 5 else scores} -> streak: {streak}"
        )
        return streak

    def _count_good_streak(self, scores: List[float]) -> int:
        streak = 0
        for score in reversed(scores):
            if score >= 80:
                streak += 1
            else:
                break
        return streak

    def _count_medium_streak(self, scores: List[float]) -> int:
        streak = 0
        for score in reversed(scores):
            if 40 <= score < 80:
                streak += 1
            else:
                break
        return streak

    def _get_last_evaluation(self, state: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        evaluations = state.get("answer_evaluations", [])
        return evaluations[-1] if evaluations else None

    def _is_unknown_response(self, evaluation: Dict[str, Any]) -> bool:
        analysis = evaluation.get("analysis", {}) or {}
        red_flags = [str(x).lower() for x in analysis.get("red_flags", []) or []]
        weaknesses = [str(x).lower() for x in analysis.get("weaknesses", []) or []]
        unknown_markers = [
            "не знает",
            "не знаю",
            "не уверен",
            "затрудняется ответить",
            "отсутствие знаний",
            "нет ответа",
            "не может ответить",
            "без ответа",
        ]
        if any(any(m in text for m in unknown_markers) for text in red_flags + weaknesses):
            return True
        detailed = evaluation.get("detailed_scores", {}) or {}
        scores = [
            detailed.get("technical_accuracy", 0),
            detailed.get("depth_of_knowledge", 0),
            detailed.get("practical_experience", 0),
            detailed.get("communication_clarity", 0),
            detailed.get("problem_solving_approach", 0),
            detailed.get("examples_and_use_cases", 0),
        ]
        low_count = sum(1 for s in scores if isinstance(s, (int, float)) and s <= 2)
        if low_count >= 4:
            return True
        total_pct = evaluation.get("score_percent")
        if isinstance(total_pct, (int, float)) and total_pct is not None and total_pct < 10:
            return True
        return False

    def _skip_topic(self, state: Dict[str, Any]) -> Dict[str, Any]:
        logger.info("Переходим к следующей теме")
        current_topic_index = state.get("current_topic_index", 0)
        logger.debug(
            f"Сбрасываем счетчики при переходе к теме {current_topic_index + 1}"
        )
        return {
            "controller_decision": "skip_topic",
            "current_topic_index": current_topic_index + 1,
            "questions_in_current_topic": 0,
            "deepening_questions_count": 0,
            "hints_given_count": 0,
            "question_type": None,
        }

    def _generate_harder_question(self, state: Dict[str, Any]) -> Dict[str, Any]:
        question = self._create_llm_question(state, "продвинутый и повышенной сложности")
        logger.debug(
            f"Сгенерирован сложный вопрос: '{question['content'][:60]}...'"
        )
        return {
            "controller_decision": "continue_topic",
            "generated_question": question,
            "question_type": "harder",
        }

    def _generate_deeper_question(self, state: Dict[str, Any]) -> Dict[str, Any]:
        question = self._create_llm_question(state, "детализированный и углубляющийся в нюансы")
        logger.debug(
            f"Сгенерирован углубленный вопрос: '{question['content'][:60]}...'"
        )
        return {
            "controller_decision": "continue_topic",
            "generated_question": question,
            "question_type": "deepening",
        }

    def _generate_easier_question(self, state: Dict[str, Any]) -> Dict[str, Any]:
        question = self._create_llm_question(state, "базовой сложности")
        logger.debug(
            f"Сгенерирован упрощенный вопрос: '{question['content'][:60]}...'"
        )
        return {
            "controller_decision": "continue_topic",
            "generated_question": question,
            "question_type": "easier",
        }

    def _generate_same_level_question(self, state: Dict[str, Any]) -> Dict[str, Any]:
        question = self._create_llm_question(state, "сопоставимой сложности")
        logger.debug(
            f"Сгенерирован вопрос того же уровня: '{question['content'][:60]}...'"
        )
        return {
            "controller_decision": "continue_topic",
            "generated_question": question,
            "question_type": "same_level",
        }

    def _provide_hint_and_question(self, state: Dict[str, Any]) -> Dict[str, Any]:
        last_evaluation = self._get_last_evaluation(state)
        weaknesses = (
            last_evaluation.get("analysis", {}).get("weaknesses", []) if last_evaluation else []
        )

        question = self._generate_guided_reformulated_question(state, weaknesses)

        logger.debug(
            f"Переформулированный вопрос с ненавязчивой подсказкой: '{question['content'][:100]}...'"
        )

        return {
            "controller_decision": "continue_topic",
            "generated_question": question,
            "question_type": "hint",
        }

    def _continue_standard_flow(self, state: Dict[str, Any]) -> Dict[str, Any]:
        return {"controller_decision": "continue_standard"}

    def _create_llm_question(self, state: Dict[str, Any], difficulty: str) -> Dict[str, Any]:
        topic = state.get("current_topic", "Programming")
        last_answer = state.get("last_candidate_answer", "")
        current_question = state.get("current_question", {}).get("content", "")
        questions_asked = state.get("questions_asked_count", 0)

        question_types = [
            "теоретический",
            "практический",
            "сравнительный",
            "примерный",
            "проблемный",
        ]
        question_type = question_types[questions_asked % len(question_types)]

        prompt = ChatPromptTemplate.from_template(
            """
            Ты — креативный технический интервьюер. Сгенерируй {difficulty} {question_type} вопрос по теме "{topic}".

            Политика выравнивания:
            {alignment}

            КОНТЕКСТ:
            - Предыдущий вопрос: {current_question}
            - Ответ кандидата: {last_answer}
            - Номер вопроса: {question_number}

            КРИТИЧЕСКИ ВАЖНО:
            1. Вопрос должен быть ПОЛНОСТЬЮ ДРУГИМ по содержанию и формулировке
            2. Используй РАЗНЫЕ аспекты темы: теория, практика, инструменты, примеры, сравнения
            3. Варьируй формат: "Как...", "Что происходит если...", "Сравните...", "Приведите пример...", "Объясните разницу..."
            4. Если тема Resume Discussion - спрашивай про конкретные проекты, технологии, достижения
            5. Если тема Python - спрашивай про разные области: структуры данных, алгоритмы, библиотеки, паттерны
            6. Если тема ML - чередуй теорию, алгоритмы, метрики, практические задачи
            7. Не упоминай уровень или должность кандидата. Не добавляй преамбулы, подсказки, ответы или списки.
            8. ВОЗВРАЩАЙ ТОЛЬКО ОДИН краткий вопрос одной строкой без лишнего текста.
            9. Избегай общих вопросов.
            10. Разбавляй формулировки словами, чтобы симулировать живое общение.

            ПРИМЕРЫ РАЗНООБРАЗИЯ для темы "Resume Discussion":
            - "Расскажите о самом сложном проекте, над которым вы работали"
            - "Какие технологии вы использовали в последнем проекте?"
            - "Как вы решали технические проблемы в команде?"
            - "Опишите ваш подход к тестированию ML моделей"

            Сгенерируй ОДИН конкретный, практичный вопрос БЕЗ повторения предыдущих тем.
            ВАЖНО: Верни ТОЛЬКО ОДИН вопрос, без дополнительных вариантов или пояснений.
            - Не упоминай название темы в тексте вопроса и не заключай весь вопрос в кавычки.
            
            ПРОВЕРЬ ПЕРЕД ГЕНЕРАЦИЕЙ:
            - Соответствует ли вопрос текущей теме и контексту, не повторяет ли предыдущее?
            - Достаточно ли он конкретен (без общих фраз) и разнообразен по типу формулировки?
            - Соблюден ли формат: одна строка, без преамбул/пояснений/списков/ответов?
            - Нейтрален ли он (без упоминания уровня/должности), на русском и профессионально сформулирован?
            """
        )

        chain = prompt | self.llm
        response = chain.invoke(
            {
                "alignment": self.alignment,
                "difficulty": difficulty,
                "question_type": question_type,
                "topic": topic,
                "current_question": current_question,
                "last_answer": last_answer[:200],
                "question_number": questions_asked,
            }
        )

        question_text = response.content.strip()
        question_text = question_text.replace("\n", " ").strip()
        if (question_text.startswith('"') and question_text.endswith('"')) or (
            question_text.startswith("'") and question_text.endswith("'")
        ):
            question_text = question_text[1:-1].strip()
        topic = state.get("current_topic", "") or ""
        if topic and topic in question_text:
            question_text = question_text.replace(topic, "").strip(" -:—")

        if len(question_text) > 500:
            first_question = question_text.split("\n")[0].split(".")[0] + "."
            question_text = first_question

        if len(question_text) < 10 or question_text == current_question:
            fallback_questions = [
                "Расскажите о задаче, которой вы особенно гордитесь: цель, ваш вклад, результат.",
                "Как вы обычно подходите к решению нетривиальных задач? Опишите шаги.",
                "Приведите пример случая, когда вы улучшили качество или эффективность процесса.",
                "Какие инструменты и практики помогают вам поддерживать качество работы?",
                "Опишите ситуацию, когда возникла сложность: что сделали, к какому выводу пришли?",
            ]
            question_text = fallback_questions[questions_asked % len(fallback_questions)]

        return {
            "id": f"llm_{difficulty}_{state.get('questions_asked_count', 0)}",
            "content": question_text,
            "source": "LLM",
            "difficulty": difficulty,
        }

    def _generate_guided_reformulated_question(
        self, state: Dict[str, Any], weaknesses: List[str]
    ) -> Dict[str, Any]:
        topic = state.get("current_topic", "Programming")
        last_answer = state.get("last_candidate_answer", "")
        prev_question = state.get("current_question", {}).get("content", "")
        questions_asked = state.get("questions_asked_count", 0)

        improvement_hint = (
            ", ".join(weaknesses[:2])
            if weaknesses
            else "ключевой аспект, который вы не раскрыли достаточно конкретно"
        )

        prompt = ChatPromptTemplate.from_template(
            """
            Ты — строгий, но тактичный интервьюер. Переформулируй предыдущий вопрос так,
            чтобы кандидат интуитивно понял, где усилить ответ, но без явных подсказок.

            Политика выравнивания:
            {alignment}

            Контекст:
            - Тема: {topic}
            - Предыдущий вопрос: {prev_question}
            - Ответ кандидата: {last_answer}
            - На что следует направить внимание (ненавязчиво, без прямых подсказок): {improvement_hint}
            - Номер вопроса: {question_number}

            Требования:
            1) Верни ТОЛЬКО ОДИН краткий вопрос одной строкой.
            2) Не используй явные подсказки типа "обратите внимание", "подумайте о" и т.п.
            3) Сформулируй вопрос так, чтобы он мягко подталкивал осветить упущенный аспект через конкретику.
            4) Не повторяй дословно предыдущий вопрос — измени угол, уточни формулировку, добавь критерий или ограничение.
            5) Без преамбул, пояснений, списков и ответов.

            ПРОВЕРЬ ПЕРЕД ГЕНЕРАЦИЕЙ:
            - Вопрос ненавязчивый (без прямых подсказок) и адресует указанный пробел.
            - Формулировка отличается от предыдущей и стимулирует конкретику.
            - Строго одна строка, без пояснений, на русском, нейтральным тоном.
            """
        )

        chain = prompt | self.llm
        response = chain.invoke(
            {
                "alignment": self.alignment,
                "topic": topic,
                "prev_question": prev_question,
                "last_answer": last_answer[:300],
                "improvement_hint": improvement_hint,
                "question_number": questions_asked,
            }
        )

        question_text = (getattr(response, "content", None) or str(response)).strip()

        if len(question_text) > 500:
            question_text = question_text.split("\n")[0].strip()
        if not question_text or len(question_text) < 10:
            base = (
                weaknesses[0]
                if weaknesses
                else "конкретные шаги/метрики вашего подхода"
            )
            question_text = (
                f"Уточните, пожалуйста, {base}: как именно вы это делаете на практике?"
            )

        return {
            "id": f"llm_guided_{state.get('questions_asked_count', 0)}",
            "content": question_text,
            "source": "LLM",
            "difficulty": "guided",
        }
