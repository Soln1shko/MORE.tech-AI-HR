import requests
import json
import logging
from flask import current_app

class AIHRServiceError(Exception):
    """Кастомное исключение для ошибок AI-HR сервиса."""
    def __init__(self, message="Ошибка взаимодействия с AI-сервисом", status_code=500):
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)

def _make_request(method, endpoint, **kwargs):
    """
    Внутренняя функция для выполнения запросов к AI-сервису с обработкой ошибок.
    """
    base_url = current_app.config['AI_HR_SERVICE_URL']
    url = f"{base_url}{endpoint}"
    
    # Устанавливаем таймаут по умолчанию
    kwargs.setdefault('timeout', 60)
    
    # Формируем заголовки с API ключом
    headers = {"Content-Type": "application/json"}
    if hasattr(current_app.config, 'OPENROUTER_API_KEY') and current_app.config['OPENROUTER_API_KEY']:
        headers["Authorization"] = f"Bearer {current_app.config['OPENROUTER_API_KEY']}"
    
    kwargs.setdefault('headers', headers)

    try:
        response = requests.request(method, url, **kwargs)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.HTTPError as e:
        logging.error(f"HTTP ошибка при запросе к AI-сервису ({url}): {e.response.status_code} {e.response.text}")
        raise AIHRServiceError(f"Сервис AI-HR вернул ошибку: {e.response.status_code}", e.response.status_code)
    except requests.exceptions.RequestException as e:
        logging.error(f"Сетевая ошибка при запросе к AI-сервису ({url}): {e}")
        raise AIHRServiceError("Не удалось связаться с AI-сервисом.")


def match_resume(resume_data, job_description, vacancy_id):
    payload = {
        'resume': resume_data,
        'vacancy_id': str(vacancy_id)
    }
    logging.info(f"Отправка запроса на /resume-match для вакансии {vacancy_id}")
    return _make_request('post', '/resume-match', json=payload)

def start_interview(resume_data, vacancy_id, job_description=""):
    payload = {
        "resume": resume_data or "Резюме не найдено",
        "vacancy_id": str(vacancy_id),
        "job_description": job_description
    }
    logging.info(f"Отправка запроса на /interviews для старта собеседования по вакансии {vacancy_id}")
    return _make_request('post', '/interviews', json=payload)

def submit_interview_answer(mlinterview_id, answer_text):
    payload = {
        "interview_id": mlinterview_id,
        "answer": answer_text
    }
    endpoint = f"/interviews/{mlinterview_id}/answer"
    logging.info(f"Отправка ответа для AI-собеседования {mlinterview_id}")
    return _make_request('post', endpoint, json=payload, timeout=30)
