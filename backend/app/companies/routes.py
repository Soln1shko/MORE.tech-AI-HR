from flask import Blueprint, request, jsonify,Response,current_app
from bson import ObjectId
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from ..core.database import users_collection, companies_collection
from ..core.utils import allowed_file, safe_filename
from ..services.export_to_yandex_cloud import create_s3_session, upload_file_object_to_s3
from ..services.delete_from_yandex_cloud import delete_file_from_s3
import os
from ..core.decorators import token_required, roles_required
import logging

companies_bp = Blueprint('companies', __name__)
logger = logging.getLogger(__name__)

@companies_bp.route('/company')
@token_required 
@roles_required('company')
def company_dashboard(caller_identity): 
    """Вернуть данные дашборда текущей компании."""
    logger.info("GET /company for company_id=%s", caller_identity.get('id'))
    company = companies_collection.find_one({'_id': ObjectId(caller_identity['id'])})
    if not company:
        logger.warning("/company not found for company_id=%s", caller_identity.get('id'))
        return jsonify({'message': 'Компания не найдена'}), 404
        
    return jsonify({
        'email': company['email'],
        'inn': company.get('inn'),
        'ogrn': company.get('ogrn'),
        'company_name': company.get('company_name'),
        'legal_address': company.get('legal_address'),
        'role': company['role']
    }), 200

@companies_bp.route('/company/avatar', methods=['POST'])
@token_required
@roles_required('company')
def upload_company_avatar(caller_identity):
    """Загрузить и сохранить аватар компании в публичную директорию фронтенда."""
    logger.info("POST /company/avatar for company_id=%s", caller_identity.get('id'))
    if 'avatar' not in request.files:
        return jsonify({'message': 'Файл аватара отсутствует'}), 400

    file = request.files['avatar']
    
    company = companies_collection.find_one({'_id': ObjectId(caller_identity['id'])})
    if not company:
        return jsonify({'message': 'Компания не найдена'}), 404
        
    company_name = company['company_name']
    
    if file and file.filename:
        def format_company_name(name):
            return name.lower().replace(' ', '_').replace('ооо', '').replace('зао', '').replace('оао', '').replace('"', '').replace("'", '').replace('«', '').replace('»', '').replace('"', '').replace('"', '').replace(''', '').replace(''', '').replace('-', '_').strip('_')
        
        formatted_name = format_company_name(company_name)

        file_extension = file.filename.rsplit('.', 1)[1].lower() if '.' in file.filename else 'jpg'
        filename = f"{formatted_name}.{file_extension}"

        avatar_dir = '../frontend/public/company_avatars'
        if not os.path.exists(avatar_dir):
            os.makedirs(avatar_dir)
            
        filepath = os.path.join(avatar_dir, filename)
        file.save(filepath)

        avatar_url = f"/company_avatars/{filename}"
        
        return jsonify({
            'message': 'Аватар успешно сохранен',
            'avatar_url': avatar_url
        }), 200
    else:
        return jsonify({'message': 'Недопустимый файл'}), 400
  
@companies_bp.route('/companies', methods=['GET'])
@token_required
def get_all_companies(caller_identity):
    """Вернуть постраничный список компаний без чувствительных полей."""
    logger.info("GET /companies for account_id=%s", caller_identity.get('id'))
    try:
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 10))
    except ValueError:
        return jsonify({'message': 'Параметры page и per_page должны быть числами'}), 400

    skip = (page - 1) * per_page

    projection = {
        'password': 0
    }
    query = {}
    cursor = companies_collection.find(query, projection).skip(skip).limit(per_page)
    companies_list = []
    for company in cursor:
        company['_id'] = str(company['_id'])
        companies_list.append(company)
    total_companies = companies_collection.count_documents(query)

    return jsonify({
        'total': total_companies,
        'page': page,
        'per_page': per_page,
        'total_pages': (total_companies + per_page - 1) // per_page,
        'companies': companies_list
    }), 200

@companies_bp.route('/company/updateprofile', methods=['PUT'])
@token_required
@roles_required('company') # Убеждаемся, что это компания
def update_own_company_profile(caller_identity):
    """Обновить поля профиля текущей компании."""
    logger.info("PUT /company/updateprofile for company_id=%s", caller_identity.get('id'))
    # 1. Получаем ID компании напрямую из токена
    company_id = caller_identity['id']

    # 2. Получение данных
    data = request.get_json()
    if not data:
        return jsonify({'message': 'Нет данных для обновления'}), 400

    # 3. Формирование полей для обновления
    update_fields = {}
    allowed_fields = ['company_name', 'inn', 'ogrn', 'legal_address']
    for field in allowed_fields:
        if field in data:
            update_fields[field] = data[field]
    
    if not update_fields:
        return jsonify({'message': 'Нет разрешенных полей для обновления'}), 400
    
    try:
        result = companies_collection.update_one(
            {'_id': ObjectId(company_id)},
            {'$set': update_fields}
        )
        if result.matched_count == 0:
            logger.warning("/company/updateprofile company not found company_id=%s", company_id)
            return jsonify({'message': 'Компания не найдена'}), 404
    except Exception as e:
        logger.exception("/company/updateprofile error: %s", e)
        return jsonify({'message': 'Ошибка при обновлении профиля компании', 'error': str(e)}), 500

    return jsonify({'message': 'Профиль компании успешно обновлен'}), 200