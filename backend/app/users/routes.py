from flask import Blueprint, request, jsonify,Response,current_app
from bson import ObjectId
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from ..core.database import users_collection, companies_collection, interviews_collection, status_history_collection
from ..core.utils import allowed_file, safe_filename
from ..services.export_to_yandex_cloud import create_s3_session, upload_file_object_to_s3
from ..services.delete_from_yandex_cloud import delete_file_from_s3
import os
from ..core.decorators import token_required, roles_required
import logging

users_bp = Blueprint('users', __name__)
logger = logging.getLogger(__name__)

@users_bp.route('/profile')
@token_required
def get_profile(caller_identity):
    """Вернуть информацию профиля текущего пользователя."""
    logger.info("GET /profile for user_id=%s", caller_identity.get('id'))
    user = users_collection.find_one({'_id': ObjectId(caller_identity['id'])})
    if not user:
        logger.warning("/profile not found for user_id=%s", caller_identity.get('id'))
        return jsonify({'message': 'Пользователь не найден'}), 404
    
    return jsonify({
        'email': user['email'],
        'telegram_id': user.get('telegram_id'),
        'name': user.get('name'),
        'surname': user.get('surname'),
        'role': user['role'],
        'resume_path': user.get('resume_path')
    })

@users_bp.route('/user/updateprofile', methods=['PUT'])
@token_required
@roles_required('user') # Убеждаемся, что это обычный пользователь
def update_own_user_profile(caller_identity):
    """Обновить поля профиля пользователя (name, surname, telegram_id)."""
    logger.info("PUT /user/updateprofile for user_id=%s", caller_identity.get('id'))
    user_id = caller_identity['id']
    data = request.get_json()
    if not data:
        return jsonify({'message': 'Нет данных для обновления'}), 400
    update_fields = {}
    allowed_fields = ['name', 'surname', 'telegram_id']
    for field in allowed_fields:
        if field in data:
            update_fields[field] = data[field]
    
    if not update_fields:
        return jsonify({'message': 'Нет разрешенных полей для обновления'}), 400

    try:
        result = users_collection.update_one(
            {'_id': ObjectId(user_id)},
            {'$set': update_fields}
        )
        if result.matched_count == 0:
            logger.warning("/user/updateprofile user not found user_id=%s", user_id)
            return jsonify({'message': 'Пользователь не найден'}), 404
    except Exception as e:
        logger.exception("/user/updateprofile error: %s", e)
        return jsonify({'message': 'Ошибка при обновлении профиля', 'error': str(e)}), 500

    return jsonify({'message': 'Профиль успешно обновлен'}), 200

@users_bp.route('/download-resume', methods=['GET'])
@token_required
def download_resume(caller_identity):
    """Скачать резюме текущего пользователя из Yandex Object Storage."""
    logger.info("GET /download-resume for user_id=%s", caller_identity.get('id'))
    try:
        user_id = caller_identity.get('_id') or caller_identity.get('id')
        if not user_id:
            return jsonify({'message': 'ID пользователя не найден'}), 400
            
        user = users_collection.find_one({"_id": ObjectId(user_id)})
        
        if not user:
            logger.warning("/download-resume user not found user_id=%s", user_id)
            return jsonify({'message': 'Пользователь не найден'}), 404
        
        if not user.get('resume_path'):
            logger.warning("/download-resume resume not found for user_id=%s", user_id)
            return jsonify({'message': 'Резюме не найдено'}), 404
        
        s3_client = create_s3_session()
        if not s3_client:
            return jsonify({'message': 'Ошибка подключения к облачному хранилищу'}), 500
        
        resume_path = user['resume_path']
        
        if resume_path.startswith('https://storage.yandexcloud.net/'):
            url_parts = resume_path.split('/')
            if len(url_parts) >= 6:
                object_name = '/'.join(url_parts[4:])  # resumes/filename.ext
            else:
                resume_filename = os.path.basename(resume_path)
                object_name = f"resumes/{resume_filename}"
        else:
            resume_filename = os.path.basename(resume_path)
            object_name = f"resumes/{resume_filename}"
        
        try:
            response = s3_client.get_object(Bucket=current_app.config['YC_STORAGE_BUCKET'], Key=object_name)
            file_content = response['Body'].read()
            
            download_filename = os.path.basename(object_name)
            
            if download_filename.lower().endswith('.pdf'):
                mimetype = 'application/pdf'
            elif download_filename.lower().endswith('.doc'):
                mimetype = 'application/msword'
            elif download_filename.lower().endswith('.docx'):
                mimetype = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            else:
                mimetype = 'application/octet-stream'
            
            response = Response(
                file_content,
                mimetype=mimetype,
                headers={
                    'Content-Disposition': f'attachment; filename="{download_filename}"',
                    'Content-Length': str(len(file_content))
                }
            )
            return response
            
        except Exception as e:
            logging.error(f"Ошибка при скачивании файла из S3: {e}")
            return jsonify({'message': 'Файл не найден в хранилище'}), 404
            
    except Exception as e:
        logger.exception("/download-resume error: %s", e)
        return jsonify({'message': 'Внутренняя ошибка сервера'}), 500

@users_bp.route('/update-resume', methods=['POST'])
@token_required
def update_resume(caller_identity):
    """Заменить резюме пользователя: удалить старое и загрузить новое в хранилище."""
    logger.info("POST /update-resume for user_id=%s", caller_identity.get('id'))
    try:
        if 'resume' not in request.files:
            return jsonify({'message': 'Файл резюме отсутствует'}), 400

        file = request.files['resume']
        if not file or not allowed_file(file.filename):
            return jsonify({'message': 'Недопустимый тип файла'}), 400

        user_id = caller_identity.get('_id') or caller_identity.get('id')
        if not user_id:
            return jsonify({'message': 'ID пользователя не найден'}), 400
            
        user = users_collection.find_one({"_id": ObjectId(user_id)})
        if not user:
            logger.warning("/update-resume user not found user_id=%s", user_id)
            return jsonify({'message': 'Пользователь не найден'}), 404

        s3_client = create_s3_session()
        if not s3_client:
            return jsonify({'message': 'Ошибка подключения к облачному хранилищу'}), 500

        old_resume_path = user.get('resume_path')
        if old_resume_path:
            if old_resume_path.startswith('https://storage.yandexcloud.net/'):
                url_parts = old_resume_path.split('/')
                if len(url_parts) >= 6:
                    old_object_name = '/'.join(url_parts[4:])
                    delete_file_from_s3(s3_client, current_app.config['YC_STORAGE_BUCKET'], old_object_name)
                    logger.info("Old resume deleted: %s", old_object_name)

        safe_name = safe_filename(file.filename)
        unique_filename = f"{user['email']}_{safe_name}"
        
        success, file_url = upload_file_object_to_s3(s3_client, file, unique_filename, current_app.config['YC_STORAGE_BUCKET'])
        
        if not success:
            return jsonify({'message': 'Ошибка при загрузке нового резюме'}), 500

        users_collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"resume_path": file_url,'parsed_resume': None}}
        )

        return jsonify({
            'message': 'Резюме успешно обновлено',
            'resume_path': file_url
        }), 200

    except Exception as e:
        logger.exception("/update-resume error: %s", e)
        return jsonify({'message': 'Внутренняя ошибка сервера'}), 500

@users_bp.route('/download-candidate-resume', methods=['GET'])
@token_required
@roles_required('company')  # Только HR может скачивать резюме кандидатов
def download_candidate_resume(caller_identity):
    logger.info("GET /download-candidate-resume by company_id=%s", caller_identity.get('id'))
    """
    Скачивание резюме кандидата HR-ом из Yandex Object Storage
    """
    try:
        # Получаем user_id кандидата из параметров запроса
        user_id = request.args.get('user_id')
        if not user_id:
            return jsonify({'message': 'user_id обязателен'}), 400
            
        user = users_collection.find_one({"_id": ObjectId(user_id)})
        
        if not user:
            logger.warning("/download-candidate-resume candidate not found user_id=%s", user_id)
            return jsonify({'message': 'Пользователь не найден'}), 404
        
        if not user.get('resume_path'):
            logger.warning("/download-candidate-resume resume not found user_id=%s", user_id)
            return jsonify({'message': 'Резюме не найдено'}), 404
        
        # Создаем S3 клиент
        s3_client = create_s3_session()
        if not s3_client:
            return jsonify({'message': 'Ошибка подключения к облачному хранилищу'}), 500
        
        # Извлекаем object_name из URL резюме
        resume_path = user['resume_path']
        
        # Если resume_path - это полный URL Yandex Cloud
        if resume_path.startswith('https://storage.yandexcloud.net/'):
            # Извлекаем путь после имени бакета
            # URL: https://storage.yandexcloud.net/bucket_name/resumes/filename.ext
            # Нужно получить: resumes/filename.ext
            url_parts = resume_path.split('/')
            if len(url_parts) >= 6:
                # Берем все после bucket_name (начиная с индекса 5)
                object_name = '/'.join(url_parts[4:])  # resumes/filename.ext
            else:
                # Fallback: используем только имя файла
                resume_filename = os.path.basename(resume_path)
                object_name = f"resumes/{resume_filename}"
        else:
            # Если это локальный путь или просто имя файла
            resume_filename = os.path.basename(resume_path)
            object_name = f"resumes/{resume_filename}"
        
        try:
            # Получаем файл из S3
            response = s3_client.get_object(Bucket=current_app.config['YC_STORAGE_BUCKET'], Key=object_name)
            file_content = response['Body'].read()
            
            # Определяем имя файла для скачивания
            download_filename = os.path.basename(object_name)
            
            # Определяем MIME тип
            if download_filename.lower().endswith('.pdf'):
                mimetype = 'application/pdf'
            elif download_filename.lower().endswith('.doc'):
                mimetype = 'application/msword'
            elif download_filename.lower().endswith('.docx'):
                mimetype = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            else:
                mimetype = 'application/octet-stream'
            
            # Создаем ответ с файлом
            response = Response(
                file_content,
                mimetype=mimetype,
                headers={
                    'Content-Disposition': f'attachment; filename="{download_filename}"',
                    'Content-Length': str(len(file_content))
                }
            )
            return response
            
        except Exception as e:
            logging.error(f"Ошибка при скачивании файла кандидата из S3: {e}")
            return jsonify({'message': 'Файл не найден в хранилище'}), 404
            
    except Exception as e:
        logger.exception("/download-candidate-resume error: %s", e)
        return jsonify({'message': 'Внутренняя ошибка сервера'}), 500
    
@users_bp.route('/user-interviews', methods=['GET'])
@token_required
@roles_required('user')
def get_all_interviews_for_user(caller_identity):
    logger.info("GET /user-interviews for user_id=%s", caller_identity.get('id'))
    """
    Возвращает список всех собеседований для указанного пользователя.
    Добавляет пагинацию для обработки больших объемов данных.
    """
    try:
        user_id = ObjectId(caller_identity['id'])
    except Exception:
        return jsonify({"message": "Некорректный формат ID пользователя."}), 400
    
    try:
        query = {'user_id': user_id}
        cursor = interviews_collection.find(query)
        total_documents = interviews_collection.count_documents(query)
        interviews_list = []
        for interview in cursor:
            # Конвертируем все ObjectId в строки для JSON serialization
            interview['_id'] = str(interview['_id'])
            if 'user_id' in interview:
                interview['user_id'] = str(interview['user_id'])
            if 'vacancy_id' in interview:
                interview['vacancy_id'] = str(interview['vacancy_id'])
            interviews_list.append(interview)
            
    except Exception as e:
        logger.exception("/user-interviews DB error: %s", e)
        return jsonify({"message": f"Ошибка при обращении к базе данных: {e}"}), 500

    return jsonify({
        "interviews": interviews_list
    }), 200

@users_bp.route('/user-interviews-status-changes', methods=['GET'])
@token_required
@roles_required('user')
def get_user_interviews_status_changes(caller_identity):
    logger.info("GET /user-interviews-status-changes for user_id=%s", caller_identity.get('id'))
    try:
        user_id = caller_identity['id']  # Используем строку, а не ObjectId
    except Exception:
        return jsonify({"message": "Некорректный формат ID пользователя."}), 400
    try:
        query = {'user_id': user_id}
        logger.debug("Searching status changes for user_id=%s", user_id)
        cursor = status_history_collection.find(query)
        # total_documents = status_history_collection.count_documents(query)
        status_changes_list = []
        for status_changes in cursor:
            # Конвертируем все ObjectId в строки для JSON serialization
            status_changes['_id'] = str(status_changes['_id'])
            if 'interview_id' in status_changes:
                status_changes['interview_id'] = str(status_changes['interview_id'])
            # user_id уже строка, не нужно конвертировать
            # vacancy_id и company_id тоже строки
            status_changes_list.append(status_changes)
        
        logger.debug("Found %d status changes", len(status_changes_list))
            
    except Exception as e:
        return jsonify({"message": f"Ошибка при обращении к базе данных: {e}"}), 500

    return jsonify({
        "status_changes": status_changes_list
    }), 200
