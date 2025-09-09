"""Модуль сопоставления резюме с требованиями вакансии."""

import re
import os
import json
from openai import OpenAI
from typing import Any, Dict, List, Optional


class FlexibleResumeMatcher:
    """
    Оценивает соответствие резюме требованиям вакансии по нескольким критериям.

    Методика предполагает расчет итогового балла (0..100) на основе взвешенной
    суммы частных оценок: обязательные навыки, дополнительные навыки, опыт и
    образование. При отсутствии API-ключа выполняется резервная эвристическая
    оценка без LLM.
    
    Attributes:
        required_skills: Список обязательных навыков.
        optional_skills: Список желательных навыков.
        min_experience: Минимальный стаж (в годах).
        max_experience: Максимальный стаж (в годах), если задан.
        education_required: Требуемый уровень образования.
        weights: Веса критериев в итоговой оценке.
    """
    def __init__(
        self,
        required_skills: List[str],
        optional_skills: List[str],
        min_experience: float,
        job_description: str,
        max_experience: Optional[float] = None,
        education_required: Optional[str] = None
    ) -> None:
        self.required_skills = required_skills
        self.optional_skills = optional_skills
        self.min_experience = min_experience
        self.max_experience = max_experience
        self.education_required = education_required
        self.job_description = job_description

    def _extract_experience(self, text: str) -> float:
        """Извлекает стаж работы из сырого текста резюме.

        Ожидает паттерн вида: "опыт работы --- <годы> лет <месяцы>".

        Args:
            text: Текст резюме.

        Returns:
            Оцененный стаж в годах (с учетом месяцев).
        """
        match = re.search(r'опыт работы\s*---\s*(\d+)\s*(?:лет|год|года)\s*(\d+)?', text.lower())
        if match:
            years = int(match.group(1))
            months = int(match.group(2)) if match.group(2) else 0
            return round(years + months / 12, 1)
        return 0.0

    def _extract_education(self, text: str) -> str:
        """Извлекает уровень образования из текста резюме.

        Args:
            text: Текст резюме.

        Returns:
            Нормализованное значение уровня образования.
        """
        text_lower = text.lower()
        if "высшее" in text_lower:
            return "высшее"
        elif "среднее специальное" in text_lower or "колледж" in text_lower:
            return "среднее специальное"
        return "не указано"

    def _check_skills(self, text: str, skills: List[str]) -> Dict[str, bool]:
        """Проверяет наличие перечисленных навыков в тексте.

        Args:
            text: Текст резюме.
            skills: Перечень навыков.

        Returns:
            Словарь {навык: найден ли в тексте}.
        """
        text_lower = text.lower()
        return {skill: bool(re.search(r'\b' + re.escape(skill.lower()) + r'\b', text_lower)) for skill in skills}

    def _fallback_rule_based(self, resume_text: str) -> Dict[str, Any]:
        """Резервная эвристическая оценка соответствия без использования LLM.

        Args:
            resume_text: Сырой текст резюме.

        Returns:
            Структура с итоговым баллом и деталями по критериям.
        """
        candidate_exp = self._extract_experience(resume_text)
        candidate_edu = self._extract_education(resume_text)
        required_skills_map = self._check_skills(resume_text, self.required_skills)
        optional_skills_map = self._check_skills(resume_text, self.optional_skills)

        req_found = sum(required_skills_map.values())
        req_total = len(self.required_skills)
        required_score = req_found / req_total if req_total > 0 else 1.0

        opt_found = sum(optional_skills_map.values())
        opt_total = len(self.optional_skills)
        optional_score = opt_found / opt_total if opt_total > 0 else 1.0
        
        experience_score = 1.0
        if candidate_exp < self.min_experience:
            penalty = (self.min_experience - candidate_exp) / self.min_experience * 0.3
            experience_score = 1.0 - penalty
        elif self.max_experience and candidate_exp > self.max_experience:
            penalty = (candidate_exp - self.max_experience) / self.max_experience * 0.1
            experience_score = 1.0 - min(penalty, 0.1)

        education_score = 1.0
        if self.education_required and candidate_edu != self.education_required:
            education_score = 0.0

        final_score = (
            required_score * self.weights["required_skills"] +
            optional_score * self.weights["optional_skills"] +
            experience_score * self.weights["experience"] +
            education_score * self.weights["education"]
        )

        return {
            "total_score_percent": round(final_score * 100),
            "details": {
                "experience": {"required_years": f"{self.min_experience}-{self.max_experience}", "candidate_has_years": candidate_exp, "score": round(experience_score*100)},
                "education": {"required": self.education_required, "candidate_has": candidate_edu, "score": round(education_score*100)},
                "required_skills": {"map": required_skills_map, "score": round(required_score*100)},
                "optional_skills": {"map": optional_skills_map, "score": round(optional_score*100)},
            }
        }
        
    def evaluate(self, resume_text: str) -> Dict[str, Any]:
        """Оценивает соответствие резюме требованиям вакансии.

        Если задан API-ключ, выполняет запрос к LLM (через OpenRouter) и ожидает
        строгий JSON-ответ. При любом сбое или отсутствии ключа используется
        резервная эвристическая оценка.

        Args:
            resume_text: Сырой текст резюме кандидата.

        Returns:
            Словарь с ключами `total_score_percent` и `details`.
        """
        api_key = os.getenv("OPENROUTER_API_KEY", "").strip()

        if not api_key:
            return self._fallback_rule_based(resume_text)

        try:
            client = OpenAI(api_key=api_key, base_url="https://openrouter.ai/api/v1")

            system_prompt = (
                "Ты — строгий HR-ассессор. Оцени соответствие резюме требованиям вакансии строго по РУБРИКЕ ниже и верни ТОЛЬКО валидный JSON.\n"
                "\n"
                "ТРЕБОВАНИЯ К ФОРМАТУ:\n"
                "- Верни исключительно JSON без текста вне JSON, без код-блоков и комментариев.\n"
                "- Все числовые оценки — целые проценты 0..100 (НЕ доли).\n"
                "- Поля: total_score_percent (int 0..100), details: experience, education, required_skills, optional_skills.\n"
                "\n"
                "ПРАВИЛА ИЗВЛЕЧЕНИЯ:\n"
                "- Извлеки стаж (в годах, допускается дробное), уровень образования (нормализуй), наличие каждого навыка из списков.\n"
                "- Если факт явно не указан, считай его отсутствующим (0/ложь).\n"
                "\n"
                "РУБРИКА И ОГРАНИЧЕНИЯ (0..100):\n"
                "- required_skills (вес weight_required): доля найденных обязательных навыков.\n"
                "  • Если не найден НИ ОДИН обязательный — required_skills.score = 0 и итоговый total_score_percent ≤ 25.\n"
                "  • Если покрытие < 50% обязательных — итоговый total_score_percent ≤ 60.\n"
                "  • Если покрытие 50..75% — итоговый total_score_percent ≤ 70.\n"
                "- optional_skills (вес weight_optional): доля найденных доп. навыков (если список пуст — 100). Всегда как проценты 0..100 (НЕ 0..1).\n"
                "- experience (вес weight_experience):\n"
                "  • Если опыт не указан или равен 0 → score = 0.\n"
                "  • Если опыт < min: score ≈ 60 при недостаче ≤ 1 год, линейно снижается до 0 при большой недостаче.\n"
                "  • Если задан max и опыт > max: штраф до −10 п.п. (нижняя граница 90).\n"
                "  • Иначе score = 100.\n"
                "- education (вес weight_education): 100 при точном соответствии требованию, иначе 0. Если требование не задано — 100.\n"
                "\n"
                "ФИНАЛЬНЫЙ БАЛЛ:\n"
                "final = required_skills.score * weight_required + optional_skills.score * weight_optional + experience.score * weight_experience + education.score * weight_education\n"
                "- Верни total_score_percent = ceil(final), ограничив диапазоном 0..100 и применив ограничения сверху.\n"
                "\n"
                "ГРАНИЧНЫЕ СЛУЧАИ:\n"
                "- Пустое резюме или очень короткое → все секции 0, total_score_percent = 0.\n"
                "- Не интерпретируй смежные формулировки как наличие конкретного обязательного навыка.\n"
            )

            vacancy_text_lines = [
                "ВАКАНСИЯ:",
                f"- Обязательные навыки: {', '.join(self.required_skills) if self.required_skills else 'нет'}",
                f"- Дополнительные навыки: {', '.join(self.optional_skills) if self.optional_skills else 'нет'}",
                f"- Минимальный опыт (лет): {self.min_experience}",
                f"- Максимальный опыт (лет): {self.max_experience if self.max_experience is not None else 'не задан'}",
                f"- Образование (требуется): {self.education_required if self.education_required else 'не задано'}",
                f"- Текст вакансии (описание требований и предстоящих заданий на работе): {self.job_description if self.job_description else 'не задано'}"
                f"- Веса: required={self.weights.get('required_skills', 0)}, optional={self.weights.get('optional_skills', 0)}, "
                f"experience={self.weights.get('experience', 0)}, education={self.weights.get('education', 0)}",
                "",
                "РЕЗЮМЕ (сырой текст, анализируй и извлекай сам):",
                resume_text.strip(),
                "",
                "Требуемый формат ответа (строго JSON без комментариев и текста вне JSON):",
                "{",
                "  \"total_score_percent\": <int 0..100>,",
                "  \"details\": {",
                "    \"experience\": {\"candidate_has_years\": <float>, \"score\": <int 0..100>},",
                "    \"education\": {\"candidate_has\": <str>, \"score\": <int 0..100>},",
                "    \"required_skills\": {\"map\": {<skill>: <bool>}, \"score\": <int 0..100>},",
                "    \"optional_skills\": {\"map\": {<skill>: <bool>}, \"score\": <int 0..100>}",
                "  }",
                "}"
            ]
            user_prompt_text = "\n".join(vacancy_text_lines)

            model_name = os.getenv("AI_HR_LLM_MODEL", "mistralai/mistral-7b-instruct:free")

            response = client.chat.completions.create(
                model=model_name,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt_text},
                ],
                temperature=0.1,
            )

            content = response.choices[0].message.content if response.choices else ""
            if not content:
                raise ValueError("Пустой ответ LLM")

            content = content.strip()
            if content.startswith("```"):
                content = content.strip('`')
                if content.lower().startswith("json\n"):
                    content = content[5:]

            parsed = json.loads(content)

            total = int(parsed.get("total_score_percent", 0))
            details = parsed.get("details", {})
            details.setdefault("experience", {})
            details.setdefault("education", {})
            details.setdefault("required_skills", {})
            details.setdefault("optional_skills", {})

            total = max(0, min(100, total))

            return {
                "total_score_percent": total,
                "details": details,
            }

        except Exception as e:
            return self._fallback_rule_based(resume_text)
