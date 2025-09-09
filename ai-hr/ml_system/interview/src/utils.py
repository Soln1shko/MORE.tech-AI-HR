import json
import re
from typing import Any, Dict


def strip_md_fences(text: str) -> str:
    if not isinstance(text, str):
        return text
    return re.sub(r"^\s*```(?:json)?|```\s*$", "", text, flags=re.IGNORECASE | re.MULTILINE).strip()


def safe_truncate(text: str, limit: int) -> str:
    if not isinstance(text, str):
        return text
    if limit <= 0:
        return ""
    return text[:limit]


def parse_llm_json(raw: str) -> Dict[str, Any]:
    """Парсинг JSON из ответа LLM с очисткой Markdown-ограждений."""
    if not isinstance(raw, str):
        raise ValueError("LLM response is not a string")
    text = strip_md_fences(raw.strip())
    if "{" in text and "}" in text:
        s = text.find("{")
        e = text.rfind("}") + 1
        text = text[s:e]
    return json.loads(text)
