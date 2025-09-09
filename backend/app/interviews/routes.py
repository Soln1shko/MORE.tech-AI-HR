from flask import Blueprint, request, jsonify,Response,current_app
import requests
from bson import ObjectId
from flask_cors import cross_origin
from ..parser.parser import DocumentParser
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from ..core.database import users_collection, companies_collection, interviews_collection, status_history_collection, vacancies_collection,interview_answers_collection
from ..core.utils import allowed_file, safe_filename
from ..services.export_to_yandex_cloud import create_s3_session, upload_file_object_to_s3
from ..services.delete_from_yandex_cloud import delete_file_from_s3
import os
from ..core.decorators import token_required, roles_required
from ..services.ai_hr import match_resume,start_interview,submit_interview_answer
import logging

interviews_bp = Blueprint('interviews', __name__)
logger = logging.getLogger(__name__)
@interviews_bp.route('/check-resume', methods=['POST', 'OPTIONS'])
@cross_origin()
@token_required
@roles_required('user')
def check_resume_score(caller_identity):
    """Проверить резюме на соответствие вакансии и создать интервью или отказ."""
    logger.info("POST /check-resume by user_id=%s", caller_identity.get('id'))
    
    if request.method == 'OPTIONS':
        return '', 200

    user_id = caller_identity['id']
    data = request.get_json()
    
    if not data or 'vacancy_id' not in data:
        return jsonify({'message': 'vacancy_id обязателен'}), 400
    
    vacancy_id = data['vacancy_id']
    
    query_filter = {
            'user_id': user_id,
            'vacancy_id': vacancy_id
    }

    existing_interview = interviews_collection.find_one(query_filter)
    if existing_interview:
        return jsonify({'message': 'Интервью уже создано'}), 400
    try:
        vacancy = vacancies_collection.find_one({'_id': ObjectId(vacancy_id)})
        if not vacancy:
            return jsonify({'message': 'Вакансия не найдена'}), 404
    except:
        return jsonify({'message': 'Некорректный ID вакансии'}), 400

    try:
        user = users_collection.find_one({'_id': ObjectId(user_id)})
        if not user:
            return jsonify({'message': 'Пользователь не найден'}), 404
            
        resume_path = user.get('resume_path')
        if not resume_path:
            return jsonify({'message': 'У пользователя нет загруженного резюме'}), 400
    except:
        return jsonify({'message': 'Ошибка при получении данных пользователя'}), 500

    parsed_resume_data = user.get('parsed_resume')
    if not parsed_resume_data:
        import sys
        sys.path.append(os.path.join(os.path.dirname(__file__), 'export_to_yandex'))
        
        s3_client = create_s3_session()
        if not s3_client:
            return jsonify({'message': 'Ошибка подключения к облачному хранилищу'}), 500
        
        if resume_path.startswith('https://storage.yandexcloud.net/'):
            object_name = '/'.join(resume_path.split('/')[4:])
        else:
            object_name = f"resumes/{os.path.basename(resume_path)}"
        
        try:
            s3_response = s3_client.get_object(Bucket=current_app.config['YC_STORAGE_BUCKET'], Key=object_name)
            file_content = s3_response['Body'].read()
            download_filename = os.path.basename(object_name)

            parser = DocumentParser(source=download_filename)
            parsed_text = parser.parse_content(file_content)

            if not parsed_text:
                return jsonify({'message': 'Не удалось извлечь текст из резюме'}), 400

            users_collection.update_one(
                {'_id': ObjectId(user_id)},
                {'$set': {'parsed_resume': parsed_text}}
            )
            parsed_resume_data = parsed_text

        except Exception as e:
            return jsonify({'message': f'Ошибка при обработке резюме: {str(e)}'}), 500

    existing_check = interviews_collection.find_one({
        'user_id': ObjectId(user_id),
        'vacancy_id': ObjectId(vacancy_id)
    })
    
    if existing_check:
        # Если запись уже существует, возвращаем её результаты
        return jsonify({
            'success': True,
            'resume_score': existing_check.get('resume_score', 0),
            'can_proceed': existing_check.get('status') != 'rejected',
            'message': 'Резюме уже было проверено ранее',
            'interview_id': str(existing_check['_id']) if existing_check.get('status') == 'active' else None
        }), 200

    try:
        
        match_result = match_resume(parsed_resume_data, vacancy.get('description', ''), vacancy_id)
        resume_score = match_result.get('total_score_percent', 0)
        
    except Exception as e:
        logger.exception("AI-HR match_resume error: %s", e)
        return jsonify({'message': 'Ошибка оценки резюме'}), 500

    try:
        interview_record = {
            'user_id': ObjectId(user_id),
            'vacancy_id': ObjectId(vacancy_id),
            'status': 'rejected' if resume_score < 20 else 'active',
            'resume_score': resume_score,
            'created_at': datetime.now(timezone.utc),
            'updated_at': datetime.now(timezone.utc)
        }
        
        if resume_score < 20:
            interview_record['rejection_reason'] = 'Низкая оценка соответствия резюме требованиям вакансии'
        else:
            interview_record['interview_analysis'] = None  # Будет заполнено позже
            
        result = interviews_collection.insert_one(interview_record)
        interview_id = str(result.inserted_id)
        
    except Exception as e:
        logger.exception("Interview record save error: %s", e)
        return jsonify({'message': 'Ошибка при сохранении результатов'}), 500

    response_data = {
        'success': True,
        'resume_score': resume_score,
        'can_proceed': resume_score >= 20,
        'message': 'Проверка резюме завершена успешно' if resume_score >= 20 else 'К сожалению, ваше резюме не соответствует требованиям данной вакансии'
    }
    
    if resume_score >= 20:
        response_data['interview_id'] = interview_id
    
    return jsonify(response_data), 200


@interviews_bp.route('/convert-resume', methods=['POST'])
@token_required
@roles_required('user')
def process_and_save_resume(caller_identity):
    """Убедиться, что резюме проверено, и вернуть активное интервью или подсказку."""
    logger.info("POST /convert-resume by user_id=%s", caller_identity.get('id'))
    user_id = caller_identity['id']
    data = request.get_json()
    
    if not data or 'vacancy_id' not in data:
        return jsonify({'message': 'vacancy_id обязателен'}), 400
        
    vacancy_id = data['vacancy_id']
    
    try:
        # Получаем пользователя и проверяем наличие распарсенного резюме
        user = users_collection.find_one({'_id': ObjectId(user_id)})
        if not user:
            return jsonify({'message': 'Пользователь не найден'}), 404
            
        parsed_resume_data = user.get('parsed_resume')
        if not parsed_resume_data:
            return jsonify({'message': 'Резюме не найдено. Сначала проверьте резюме через соответствующую кнопку.'}), 400

        # Получаем информацию о вакансии
        vacancy = vacancies_collection.find_one({'_id': ObjectId(vacancy_id)})
        if not vacancy:
            return jsonify({'message': 'Вакансия не найдена'}), 404

        # Проверяем, что резюме уже было оценено (есть запись в interviews с этой парой user_id + vacancy_id)
        existing_interview = interviews_collection.find_one({
            'user_id': ObjectId(user_id),
            'vacancy_id': ObjectId(vacancy_id)
        })
        
        if existing_interview:
            if existing_interview.get('status') == 'rejected':
                return jsonify({'message': 'Ваше резюме не прошло предварительную проверку для данной вакансии'}), 403
            elif existing_interview.get('status') in ['completed', 'offer', 'test_task', 'finalist']:
                return jsonify({'message': 'Собеседование для данной вакансии уже завершено'}), 200
            elif existing_interview.get('status') == 'active':
                return jsonify({
                    'interview_id': str(existing_interview['_id']),
                    'message': 'Собеседование готово к началу'
                }), 200

        # Если не нашли существующее интервью, значит резюме не было проверено
        return jsonify({'message': 'Сначала необходимо проверить соответствие резюме через кнопку "Проверить резюме"'}), 400

    except Exception as e:
        logger.exception("/convert-resume error: %s", e)
        return jsonify({'message': f'Внутренняя ошибка сервера: {str(e)}'}), 500
    
@interviews_bp.route('/interviews/answer', methods=['POST', 'OPTIONS'])
@cross_origin()
@token_required
@roles_required('user')
def save_interview_answer(caller_identity):
    """Сохранить ответ пользователя на шаг интервью и управлять процессом."""
    logger.info("%s /interviews/answer called", request.method)
    
    # Обработка CORS preflight запроса
    if request.method == 'OPTIONS':
        return '', 200
    
    # --- 1. Получение данных из запроса ---
    data = request.get_json()
    logger.debug("Request data: %s", data)
    logger.debug("Caller identity: %s", caller_identity)
    if not data:
        return jsonify({'message': 'Нет данных в запросе'}), 400
    mlinterview_id = data.get('mlinterview_id')
    interview_id = data.get('interview_id')
    question = data.get('question') 
    answer_text = data.get('answer_text')
    analysis = data.get('analysis')  # Добавляем поддержку анализа речи
    vacancy_id = interviews_collection.find_one({'_id': ObjectId(interview_id)})['vacancy_id']

    # --- 2. Валидация обязательных полей ---
    if not interview_id:
        return jsonify({'message': 'Поле interview_id обязательно'}), 400

    # Если это первый запрос (mlinterview_id пустой), то question и answer_text могут быть пустыми
    if mlinterview_id and mlinterview_id.strip():
        # Это не первый запрос - валидируем все поля
        if not question or not answer_text:
            return jsonify({'message': 'Поля question и answer_text обязательны для ответа'}), 400
        
        if not isinstance(answer_text, str) or not answer_text.strip():
            return jsonify({'message': 'Поле answer_text не может быть пустым'}), 400

    # --- 3. Получение ID пользователя из токена ---
    user_id = caller_identity['id']
    

    # --- 4. Формирование документа для сохранения ---
    # Инициализируем answer_document как None - будет заполнен позже
    answer_document = None

    # --- 5. Логика обработки запроса ---
    if mlinterview_id == '' or not mlinterview_id:
        try:
            user_document = users_collection.find_one(
                {"_id": ObjectId(user_id)},  # Фильтр для поиска по ID (ObjectId)
                {"parsed_resume": 1, "_id": 0}  # Проекция: 1 - включить, 0 - исключить
            )
            parsed_resume_data = None  # Инициализируем по умолчанию
            
            if user_document:
                # Безопасно извлекаем поле с помощью .get()
                parsed_resume_data = user_document.get("parsed_resume")
                
                if parsed_resume_data:
                    logger.debug("Parsed resume found for user_id=%s", user_id)
                else:
                    logger.debug("User found but parsed_resume missing/empty user_id=%s", user_id)
                    
            else:
                logger.warning("User with ID %s not found", user_id)
            # Ограничиваем длину резюме для AI-сервиса
            resume_for_ai = parsed_resume_data[:2000] if parsed_resume_data else "Резюме не найдено"
            logger.debug("Sending resume to AI length=%d", len(resume_for_ai))
            
            # Получаем описание вакансии
            vacancy = vacancies_collection.find_one({'_id': ObjectId(vacancy_id)})
            job_description = vacancy.get('description', '') if vacancy else ''
            
            try:
                response_data = start_interview(resume_for_ai, str(vacancy_id), job_description)
            except Exception as e:
                logger.exception("AI service start_interview error: %s", e)
                # Если AI-сервис недоступен, создаем фиктивный ответ для продолжения работы
                response_data = {
                    'interview_id': f"mock_{interview_id}",
                    'status': 'active',
                    'current_question': 'Расскажите о себе и своем опыте работы',
                    'report': None,
                    'recommendation': None
                }
            mlinterview_id = response_data['interview_id']
            # Для первого запроса используем current_question из ответа
            first_question = response_data.get('current_question', 'Расскажите о себе и своем опыте работы')
            logger.debug("Saving first answer status=%s ai_question='%s' final_question='%s'", response_data['status'], response_data.get('current_question'), first_question)
            answer_document = {
                'interview_id': interview_id,
                'mlinterview_id': mlinterview_id,
                'question': first_question,
                'status': response_data['status'],
                'answer_text': answer_text,
                'report': response_data.get('report'),
                'recommendation': response_data.get('recommendation'),
                'voice_analysis': analysis  # Добавляем анализ речи
            }
            try:
                # Вставляем новый документ в коллекцию interview_answers
                interview_answers_collection.insert_one(answer_document)
            except Exception as e:
                return jsonify({'message': 'Ошибка при сохранении ответа', 'error': str(e)}), 500
        except requests.exceptions.RequestException as e:
            return jsonify({'message': 'Ошибка при отправке запроса', 'error': str(e)}), 500
    else:
        try:
            
            # Парсинг успешного JSON-ответа
            response_data = submit_interview_answer(mlinterview_id, answer_text)
            logger.debug("AI-HR response: %s", response_data)
            # Используем переданный вопрос, если current_question пустой (особенно для последнего вопроса)
            question_to_save = response_data.get('current_question') or question
            logger.debug("Saving answer status=%s ai_question='%s' provided_question='%s' final_question='%s'", response_data['status'], response_data.get('current_question'), question, question_to_save)
            
            # Обновляем answer_document для возврата клиенту
            answer_document = {
                'interview_id': interview_id,
                'mlinterview_id': mlinterview_id,
                'question': question_to_save,
                'status': response_data['status'],
                'answer_text': answer_text,
                'recommendation': response_data['recommendation'],
                'voice_analysis': analysis  # Добавляем анализ речи
            }
            
            answer = {
                'interview_id': interview_id,
                'mlinterview_id': mlinterview_id,
                'question': question_to_save,
                'status': response_data['status'],
                'answer_text': answer_text,
                'recommendation': response_data['recommendation'],
                'voice_analysis': analysis  # Добавляем анализ речи
            }
            if response_data['status']== 'completed':
                answer_document['report'] = response_data['report']
                answer_document['question'] = question_to_save  # Убедимся, что вопрос сохранён в answer_document тоже
                interviews_collection.update_one({'_id': ObjectId(interview_id)}, {'$set': {'status': 'completed', 'interview_analysis': response_data['report'], 'recommendation': response_data['recommendation']}})
            
            # Сохраняем ответ в базу данных
            try:
                interview_answers_collection.insert_one(answer)
            except Exception as e:
                return jsonify({'message': 'Ошибка при сохранении ответа', 'error': str(e)}), 500
                
        except requests.exceptions.RequestException as e:
            return jsonify({'message': 'Ошибка при отправке запроса', 'error': str(e)}), 500
        

    # --- 6. Успешный ответ ---
    if answer_document:
        # Создаем JSON-совместимую версию без ObjectId
        response_data = {
            'interview_id': answer_document.get('interview_id'),
            'mlinterview_id': answer_document.get('mlinterview_id'),
            'question': answer_document.get('question'),
            'current_question': answer_document.get('question'),  
            'status': answer_document.get('status'),
            'answer_text': answer_document.get('answer_text'),
            'voice_analysis': answer_document.get('voice_analysis'),
            'message': 'Ответ успешно сохранен'
        }
        logger.debug("Sending response to client: %s", response_data)
        return jsonify(response_data), 201
    else:
        return jsonify({'message': 'Ошибка при обработке запроса'}), 500

@interviews_bp.route('/interviews/<interview_id>/qna', methods=['GET'])
@token_required
def get_interview_qna(caller_identity, interview_id):
    """Вернуть список всех вопросов и ответов для сессии интервью."""
    # --- 1. Authorization Check (Important!) ---
    # We need to ensure that the person requesting this data has the right to see it.
    # Either the user who owns the interview or the company who owns the vacancy.
    try:
        # Find the interview session to get user_id and vacancy_id
        interview_session = interviews_collection.find_one({'_id': ObjectId(interview_id)})
        if not interview_session:
            return jsonify({'message': 'Interview session not found'}), 404

        user_id_from_interview = interview_session.get('user_id')
        vacancy_id_from_interview = interview_session.get('vacancy_id')

        # Find the vacancy to get the company_id
        vacancy = vacancies_collection.find_one({'_id': ObjectId(vacancy_id_from_interview)})
        if not vacancy:
            return jsonify({'message': 'Associated vacancy not found'}), 404
        
        company_id_from_vacancy = vacancy.get('company_id')
        
        # Check if the caller is either the user or the company
        is_user_owner = caller_identity['role'] == 'user' and caller_identity['id'] == user_id_from_interview
        is_company_owner = caller_identity['role'] == 'company' and caller_identity['id'] == company_id_from_vacancy

        if not (is_user_owner or is_company_owner):
            return jsonify({'message': 'You do not have permission to view these answers'}), 403

    except Exception:
        return jsonify({'message': 'Invalid ID format'}), 400

    # --- 2. Data Retrieval ---
    # If authorization check passed, find all answers for this interview
    try:
        # The query to find all documents with the matching interview_id
        query = {'interview_id': interview_id}
        
        # Sorting by creation time to get a chronological history
        cursor = interview_answers_collection.find(query).sort('created_at', 1)

        qna_list = []
        for answer_doc in cursor:
            answer_doc['_id'] = str(answer_doc['_id'])
            qna_list.append(answer_doc)

    except Exception as e:
        return jsonify({'message': 'Error retrieving interview answers', 'error': str(e)}), 500
        
    # --- 3. Successful Response ---
    return jsonify({
        'interview_id': interview_id,
        'qna': qna_list
    }), 200

@interviews_bp.route('/interviews/<interview_id>/status', methods=['PUT'])
@token_required
def update_interview_status(caller_identity, interview_id):
    """Обновить статус интервью; менять может только компания-владелец."""
    # --- 1. Валидация входящих данных ---
    data = request.get_json()
    if not data or 'status' not in data:
        return jsonify({'message': 'Поле "status" обязательно для обновления'}), 400

    new_status = data['status']
    valid_statuses = ['rejected', 'completed', 'test_task', 'finalist', 'offer']
    if new_status not in valid_statuses:
        return jsonify({
            'message': f'Недопустимый статус "{new_status}".',
            'allowed_statuses': valid_statuses
        }), 400

    # --- 2. Проверка прав доступа ---
    # Предполагаем, что менять статус может только компания
    if caller_identity['role'] != 'company':
        return jsonify({'message': 'Только компания может изменять статус собеседования'}), 403

    try:
        # Находим собеседование, чтобы получить ID вакансии
        interview = interviews_collection.find_one({'_id': ObjectId(interview_id)})
        if not interview:
            return jsonify({'message': 'Собеседование не найдено'}), 404

        # Находим вакансию, чтобы проверить, принадлежит ли она текущей компании
        vacancy = vacancies_collection.find_one({'_id': ObjectId(interview['vacancy_id'])})
        if not vacancy:
            return jsonify({'message': 'Связанная вакансия не найдена'}), 404

        if vacancy.get('company_id') != caller_identity['id']:
            return jsonify({'message': 'У вас нет прав для управления этим собеседованием'}), 403

    except Exception:
        return jsonify({'message': 'Неверный формат ID'}), 400

    # --- 3. Обновление статуса в MongoDB ---
    try:
        update_result = interviews_collection.update_one(
            {'_id': ObjectId(interview_id)},
            {'$set': {
                'status': new_status,
                'updated_at': datetime.now(timezone.utc) # Обновляем метку времени
            }}
        )

        if update_result.matched_count == 0:
            return jsonify({'message': 'Собеседование не найдено для обновления'}), 404

    except Exception as e:
        return jsonify({'message': 'Ошибка при обновлении статуса', 'error': str(e)}), 500

    # --- 4. Успешный ответ ---
    return jsonify({'message': f'Статус собеседования успешно изменен на "{new_status}"'}), 200

@interviews_bp.route('/interviews/change-status', methods=['PUT', 'OPTIONS'])
@cross_origin()
@token_required
@roles_required('company') 
def decide_interview_status_flask(caller_identity):
    """
    Устанавливает статус собеседования: 'rejected' или 'accepted'.
    """
    # Обработка CORS preflight запроса
    if request.method == 'OPTIONS':
        return '', 200
  
    data = request.get_json()

    if not data or 'status' not in data or 'interview_id' not in data:
        return jsonify({"message": "Тело запроса должно содержать поле 'status'"}), 400

    new_status = data['status']
    interview_id = data['interview_id']
    if new_status not in ['rejected', 'completed', 'test_task', 'finalist', 'offer']:
        return jsonify({
            "message": "Недопустимое значение для статуса.",
            "allowed_statuses": ['rejected', 'completed', 'test_task', 'finalist', 'offer']
        }), 400

    try:
        interview_oid = ObjectId(interview_id)

    except Exception:
        return jsonify({"message": "Некорректный формат ID собеседования."}), 400
    try:
        update_result = interviews_collection.update_one(
            {'_id': interview_oid},
            {'$set': {
                'status': new_status,
                'updated_at': datetime.now(timezone.utc)
            }}
        )
        if update_result.matched_count == 0:
            return jsonify({"message": "Собеседование с таким ID не найдено."}), 404
        else:
            pipeline = [
            # 1. Найти нужный документ собеседования по _id
            {
                '$match': { '_id': interview_oid }
            },
            # 2. Присоединить (lookup) данные из коллекции 'vacancies'
            {
                '$lookup': {
                    'from': 'vacancies',          # Из какой коллекции брать данные
                    'localField': 'vacancy_id',   # Поле в текущей коллекции (interviews)
                    'foreignField': '_id',        # Поле в присоединяемой коллекции (vacancies)
                    'as': 'vacancy_info'          # Куда сложить результат (в массив)
                }
            },
            # 3. "Развернуть" массив vacancy_info, чтобы он стал объектом
            # (полезно, если мы точно знаем, что вакансия одна)
            {
                '$unwind': {
                    'path': '$vacancy_info',
                    'preserveNullAndEmptyArrays': True # Сохранить собеседование, даже если вакансия не нашлась
                }
            },
            # 4. Сформировать итоговый документ, выбрав только нужные поля
            {
                '$project': {
                    '_id': 0, # Не включать ID собеседования в итоговый результат
                    'user_id': '$user_id',
                    'vacancy_id': '$vacancy_id',
                    'company_id': '$vacancy_info.company_id' # Берем поле из присоединенного документа
                }
            }
            ]

            try:
                # Выполняем агрегацию
                result = list(interviews_collection.aggregate(pipeline))

                data = result[0]
                
                # Конвертируем ObjectId в строки для безопасной передачи в JSON
                data['user_id'] = str(data['user_id']) if data.get('user_id') else None
                data['vacancy_id'] = str(data['vacancy_id']) if data.get('vacancy_id') else None
                data['company_id'] = str(data['company_id']) if data.get('company_id') else None

                update_status = status_history_collection.insert_one({
                    'interview_id': interview_oid,
                    'user_id': data['user_id'],
                    'vacancy_id': data['vacancy_id'],
                    'company_id': data['company_id'],
                    'status': new_status,
                    'updated_at': datetime.now(timezone.utc)
                })
            except Exception as e:
                return jsonify({"message": f"Ошибка при обновлении базы данных: {e}"}), 500
    except Exception as e:
        return jsonify({"message": f"Ошибка при обновлении базы данных: {e}"}), 500

    return jsonify({
        "message": "Статус собеседования успешно обновлен",
    }), 200
@interviews_bp.route('/vacancies/<vacancy_id>/interviews', methods=['GET'])
@token_required
@roles_required('company')
def get_interviews_for_vacancy(caller_identity, vacancy_id):
    """Постраничный список интервью по вакансии, принадлежащей компании."""
    # --- 1. Проверка прав доступа ---
    # Убедимся, что компания запрашивает собеседования по своей же вакансии
    try:
        vacancy = vacancies_collection.find_one({'_id': ObjectId(vacancy_id)})
        if not vacancy:
            return jsonify({'message': 'Вакансия не найдена'}), 404
        if vacancy.get('company_id') != caller_identity['id']:
            return jsonify({'message': 'У вас нет прав для просмотра собеседований по этой вакансии'}), 403
    except Exception:
        return jsonify({'message': 'Неверный формат ID вакансии'}), 400

    # --- 2. Пагинация ---
    try:
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 20)) # Увеличим стандартный лимит
    except ValueError:
        return jsonify({'message': 'Параметры page и per_page должны быть числами'}), 400
    
    skip = (page - 1) * per_page

    # --- 3. Фильтрация и поиск в MongoDB ---
    query = {'vacancy_id': vacancy_id}
    
    cursor = interviews_collection.find(query).skip(skip).limit(per_page)

    # --- 4. Подготовка ответа ---
    interviews_list = []
    for interview in cursor:
        # Конвертируем все ObjectId в строки для JSON сериализации
        interview['_id'] = str(interview['_id'])
        if 'user_id' in interview:
            interview['user_id'] = str(interview['user_id'])
        if 'vacancy_id' in interview:
            interview['vacancy_id'] = str(interview['vacancy_id'])
        interviews_list.append(interview)
    
    # --- 5. Получение общего количества документов для пагинации ---
    total_interviews = interviews_collection.count_documents(query)

    # --- 6. Успешный ответ ---
    return jsonify({
        'total': total_interviews,
        'page': page,
        'per_page': per_page,
        'total_pages': (total_interviews + per_page - 1) // per_page,
        'interviews': interviews_list
    }), 200

@interviews_bp.route('/interviews/<interview_id>', methods=['DELETE'])
@token_required
@roles_required('user')
def delete_interview(caller_identity, interview_id):
    """
    Удаляет интервью и все связанные с ним данные при выходе пользователя из собеседования.
    Только пользователь-владелец интервью может удалить его.
    """
    user_id = caller_identity['id']
    
    try:
        # --- 1. Проверка существования интервью и прав доступа ---
        interview = interviews_collection.find_one({'_id': ObjectId(interview_id)})
        if not interview:
            return jsonify({'message': 'Интервью не найдено'}), 404
            
        # Проверяем, что пользователь является владельцем интервью
        if str(interview.get('user_id')) != user_id:
            return jsonify({'message': 'У вас нет прав для удаления этого интервью'}), 403
            
        # --- 2. Удаление всех ответов интервью ---
        try:
            answers_result = interview_answers_collection.delete_many({'interview_id': ObjectId(interview_id)})
            logger.info("Deleted answers: %d", answers_result.deleted_count)
        except Exception as e:
            logger.exception("Error deleting answers: %s", e)
            
        # --- 3. Удаление записей истории статусов ---
        try:
            status_result = status_history_collection.delete_many({'interview_id': ObjectId(interview_id)})
            logger.info("Deleted status history: %d", status_result.deleted_count)
        except Exception as e:
            logger.exception("Error deleting status history: %s", e)
            
        # --- 4. Удаление самого интервью ---
        delete_result = interviews_collection.delete_one({'_id': ObjectId(interview_id)})
        
        if delete_result.deleted_count == 0:
            return jsonify({'message': 'Интервью не было удалено'}), 500
            
        logger.info("Interview %s deleted by user %s", interview_id, user_id)
        
        return jsonify({
            'message': 'Интервью успешно удалено',
            'deleted_interview_id': interview_id,
            'deleted_answers': answers_result.deleted_count if 'answers_result' in locals() else 0,
            'deleted_status_history': status_result.deleted_count if 'status_result' in locals() else 0
        }), 200
        
    except Exception as e:
        logger.exception("Error deleting interview %s: %s", interview_id, e)
        return jsonify({'message': f'Ошибка при удалении интервью: {str(e)}'}), 500