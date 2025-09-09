## Бэкенд (Flask) — Руководство по запуску и API

Этот сервис — REST API на Flask для платформы подбора и проведения собеседований. Он работает с MongoDB, интегрируется с AI-сервисом оценки резюме и интервью, поддерживает загрузку резюме в Yandex Object Storage и CORS для фронтенда.

### Технологии
- **Flask 3** (+ CORS)
- **MongoDB** (pymongo)
- **JWT** (PyJWT)
- **bcrypt** (хеширование паролей)
- **Yandex Object Storage** (boto3) — опционально

### Структура проекта (бэкенд)
- `run.py` — точка входа
- `config.py` — конфигурация
- `app/__init__.py` — фабрика приложения и регистрация блюпринтов
- `app/auth` — аутентификация и регистрация
- `app/users` — профиль пользователя и резюме
- `app/companies` — профиль компании и аватар
- `app/vacancies` — CRUD вакансий и вопросы
- `app/interviews` — проверки резюме, интервью, ответы, статусы
- `app/core` — БД, декораторы (`token_required`, `roles_required`), утилиты
- `app/services` — работа с S3, AI-HR

### Переменные окружения (.env)
- `MONGO_URI` — строка подключения к MongoDB (обязательно)
- `SECRET_KEY` — ключ для подписи JWT (обязательно)
- `AI_HR_SERVICE_URL` — URL AI-сервиса (по умолчанию `http://127.0.0.1:8002`, в docker-compose — `http://ai-hr:8002`)
- `YC_STORAGE_BUCKET` — имя бакета в Yandex Object Storage (если используется)
- `OPENROUTER_API_KEY` — ключ для AI (используется в сервисе ai-hr)

Пример `.env` (в корне репозитория):
```
MONGO_URI=mongodb://user:pass@host:27017/dbname
SECRET_KEY=change-me
AI_HR_SERVICE_URL=http://ai-hr:8002
YC_STORAGE_BUCKET=my-bucket
OPENROUTER_API_KEY=sk-...
```

### Установка и запуск локально
Требуется Python 3.11+ и запущенная MongoDB.

1) Установите зависимости (можно через Dockerfile, но проще локально):
```
pip install Flask==3.0.3 flask-cors==4.0.1 pymongo==4.10.1 python-dotenv==1.0.1 requests==2.32.3 boto3==1.35.71 PyPDF2==3.0.1 python-docx==1.1.2 bcrypt==4.2.0 PyJWT==2.9.0
```

2) Создайте `.env` в корне (см. выше).

3) Запустите бэкенд:
```
cd backend
python run.py
```
Сервис поднимется на `http://127.0.0.1:5000`.

### Запуск через Docker (рекомендуется с фронтендом и сервисами)
В корне проекта есть `docker-compose.yml`, который поднимает фронтенд, бэкенд, ai-hr, transcription, tts.

1) Создайте `.env` в корне (см. выше)
2) Запустите:
```
docker compose up -d --build
```
Бэкенд будет доступен на `http://localhost:5000`.

### Аутентификация
- Логин выдает JWT: `POST /login` (email, password)
- Токен передается в заголовке `Authorization: Bearer <token>`
- У ресурсов могут быть ограничения по ролям: `user` либо `company`

### Хранилище резюме
- По умолчанию файлы могут сохраняться локально в `uploads/resumes`
- При наличии `YC_STORAGE_BUCKET` и корректных ключей окружения используется Yandex Object Storage

### Основные эндпоинты

АВТОРИЗАЦИЯ (`app/auth/routes.py`)
- `POST /login` — вход пользователя/компании, ответ: `{ token, role }`
- `POST /register` — регистрация пользователя с загрузкой `resume` (multipart/form-data)
- `POST /register/company` — регистрация компании (JSON)

ПОЛЬЗОВАТЕЛИ (`app/users/routes.py`)
- `GET /profile` — получить профиль текущего пользователя
- `PUT /user/updateprofile` — обновить профиль пользователя (name, surname, telegram_id)
- `GET /download-resume` — скачать резюме текущего пользователя из S3
- `POST /update-resume` — заменить резюме (удаление старого, загрузка нового)
- `GET /download-candidate-resume?user_id=...` — скачать резюме кандидата (роль: company)
- `GET /user-interviews` — список интервью пользователя
- `GET /user-interviews-status-changes` — история изменений статусов интервью пользователя

КОМПАНИИ (`app/companies/routes.py`)
- `GET /company` — данные компании (роль: company)
- `POST /company/avatar` — загрузка аватара компании (сохранение в `frontend/public/company_avatars`)
- `GET /companies?page=&per_page=` — список компаний (без паролей)
- `PUT /company/updateprofile` — обновление профиля компании (роль: company)

ВАКАНСИИ (`app/vacancies/routes.py`)
- `POST /vacancies/create` — создать вакансию (роль: company)
- `GET /vacancies` — список вакансий (фильтр по `company_id` опционален)
- `POST /vacancies/{vacancy_id}/questions` — задать/обновить вопросы по вакансии (роль: company, владелец)
- `GET /vacancies/{vacancy_id}/questions` — получить вопросы вакансии
- `PUT /vacancies/{vacancy_id}` — обновить вакансию (роль: company, владелец)
- `DELETE /vacancies/{vacancy_id}` — удалить вакансию (роль: company, владелец)
- `GET /vacancies/{vacancy_id}/candidates` — кандидаты (интервью) по вакансии (роль: company, владелец)

СОБЕСЕДОВАНИЯ (`app/interviews/routes.py`)
- `POST /check-resume` — оценка соответствия резюме вакансии, создает запись интервью или отказ (роль: user)
- `POST /convert-resume` — проверка готовности интервью после оценки резюме (роль: user)
- `POST /interviews/answer` — старт и отправка ответов в AI, хранение Q&A (роль: user)
- `GET /interviews/{interview_id}/qna` — список вопросов/ответов (роль: владелец-пользователь или владелец-вакансии компания)
- `PUT /interviews/{interview_id}/status` — смена статуса интервью (только компания-владелец вакансии)
- `PUT /interviews/change-status` — смена статуса + запись в `status_history` (роль: company)
- `GET /vacancies/{vacancy_id}/interviews` — интервью по вакансии (роль: company, владелец)
- `DELETE /interviews/{interview_id}` — удалить интервью и связанные данные (роль: user, владелец)

Статусы интервью, которые поддерживаются: `rejected`, `completed`, `test_task`, `finalist`, `offer`.

### JWT и роли
- После `POST /login` используйте выданный `token` в `Authorization`
- Декораторы `token_required` и `roles_required` проверяют доступ

### Логи
- Логи запросов/ответов и ошибок настраиваются в `app/logging_config.py`, инициализируются в `app/__init__.py`

### CORS
- Разрешены все источники (`CORS(app, origins="*")`), необходимые заголовки выставляются автоматически

### Сборка образа бэкенда отдельно
```
cd backend
docker build -t moretech-backend:latest .
docker run --env-file ../.env -p 5000:5000 moretech-backend:latest
```

### Примечания
- Для работы S3 потребуется корректная конфигурация AWS/Yandex ключей в окружении контейнера/процесса
- Если S3 не настроен, резюме сохраняются локально в `uploads/resumes`


