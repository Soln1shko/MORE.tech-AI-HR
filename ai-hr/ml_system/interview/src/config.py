from dataclasses import dataclass


@dataclass
class InterviewConfig:
    # LLM/model
    model: str = "mistralai/mistral-7b-instruct:free"
    temperature: float = 0.1
    base_url: str = "https://openrouter.ai/api/v1"

    # Limits
    max_total_questions: int = 10
    max_questions_per_topic: int = 2

    # Controller limits
    max_poor_answers: int = 1
    max_medium_answers: int = 2
    max_deepening_questions: int = 1
    max_hints: int = 1

    # RAG
    collection_name: str = "interview_questions_hf"

    # Alignment/policy
    alignment: str = (
        "Правила выравнивания (соблюдай строго):\n"
        "- Пиши ТОЛЬКО на русском языке.\n"
        "- Строгая релевантность роли и текущей теме. Не добавляй ML, если роль не про ML.\n"
        "- Гиперперсонализация под роль/домен кандидата.\n"
        "- Избегай токсичности, дискриминации и раскрытия персональных данных.\n"
        "- Будь кратким и профессиональным.\n"
        "- Не галлюцинируй факты.\n"
        "- В генерации вопросов: только ОДИН конкретный вопрос, без преамбул и пояснений.\n"
    )
