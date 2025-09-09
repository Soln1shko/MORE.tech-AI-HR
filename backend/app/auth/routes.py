from flask import Blueprint, request, jsonify, current_app
import logging
from bson import ObjectId
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from ..core.database import users_collection, companies_collection
from ..core.utils import allowed_file, safe_filename
from ..services.export_to_yandex_cloud import create_s3_session, upload_file_object_to_s3
import os

auth_bp = Blueprint('auth', __name__)
logger = logging.getLogger(__name__)

@auth_bp.route('/login', methods=['POST'])
def login():
    """Аутентифицировать пользователя или компанию по email и паролю и выдать JWT."""
    logger.info("POST /login called")
    data = request.get_json()
    if not data or not data.get('email') or not data.get('password'):
        logger.warning("/login missing credentials")
        return jsonify({'message': 'Неполные данные'}), 400

    email = data['email']
    password = data['password']

    account = users_collection.find_one({'email': email})
    if not account:
        account = companies_collection.find_one({'email': email}) 
    if account and bcrypt.checkpw(password.encode('utf-8'), account['password']):
        role = account.get('role')
        
        token = jwt.encode({
            'account_id': str(account['_id']),
            'user': email,
            'role': role, 
            'exp': datetime.now(timezone.utc) + timedelta(hours=24)
        }, current_app.config['SECRET_KEY'], algorithm='HS256')

        logger.info(f"/login success for {email} as {role}")
        return jsonify({'token': token, 'role': role}), 200
    logger.warning(f"/login failed for {email}")
    
@auth_bp.route('/register', methods=['POST'])
def register():
    """Зарегистрировать нового пользователя с загрузкой резюме (в облако или локально)."""
    logger.info("POST /register called")
    if 'resume' not in request.files:
        logger.warning("/register no resume file provided")
        return jsonify({'message': 'Файл резюме отсутствует'}), 400

    file = request.files['resume']

    email = request.form.get('email')
    password = request.form.get('password')
    telegram_id = request.form.get('telegram_id')
    name = request.form.get('name')
    surname = request.form.get('surname')

    if not email or not password:
        logger.warning("/register missing email or password")
        return jsonify({'message': 'Email и пароль обязательны'}), 400

    if users_collection.find_one({'email': email}):
        logger.warning(f"/register user already exists: {email}")
        return jsonify({'message': 'Пользователь с таким email уже существует'}), 409

    if file and allowed_file(file.filename):
        # Используем нашу улучшенную функцию для обработки имен файлов
        safe_name = safe_filename(file.filename)
        unique_filename = f"{email}_{safe_name}"
        
        # Пытаемся загрузить в Yandex Storage
        file_url = None
        s3_client = create_s3_session()
        
        if s3_client and current_app.config['YC_STORAGE_BUCKET']:
            # Загружаем в Yandex Storage
            success, file_url = upload_file_object_to_s3(s3_client, file, unique_filename, current_app.config['YC_STORAGE_BUCKET'])
            
            if success:
                filepath = file_url
                logger.info(f"Resume uploaded to Yandex Storage for {email}: {file_url}")
            else:
                filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], unique_filename)
                file.save(filepath)
                logger.warning(f"Yandex upload failed, saved locally: {filepath}")
        else:
            # Если нет настроек для Yandex Storage, сохраняем локально
            filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], unique_filename)
            file.save(filepath)
            logger.info("Yandex Storage not configured, saved locally: %s", filepath)
    else:
        return jsonify({'message': 'Недопустимый тип файла'}), 400

    hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
    
    users_collection.insert_one({
        'email': email,
        'password': hashed_password,
        'telegram_id': telegram_id,
        'name': name,
        'surname': surname,
        'resume_path': filepath, 
        'role': 'user'
    })
    logger.info(f"/register success for {email}")
    return jsonify({'message': 'Пользователь успешно зарегистрирован'}), 201

@auth_bp.route('/register/company', methods=['POST'])
def register_company():
    """Зарегистрировать новую компанию с учетными данными и реквизитами."""
    data = request.get_json()
    
    company_name = data.get('company_name')
    inn = data.get('inn')
    ogrn = data.get('ogrn')
    legal_address = data.get('legal_address')
    email = data.get('email')
    password = data.get('password')

    required_fields = [company_name, inn, ogrn, legal_address, email, password]
    if not all(required_fields):
        return jsonify({'message': 'Все поля обязательны для заполнения'}), 400
    if companies_collection.find_one({'company_name': {'$regex': f'^{company_name}$', '$options': 'i'}}):
        return jsonify({'message': 'Компания с таким названием уже зарегистрирована'}), 409
    hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
    
    new_company = {
        'company_name': company_name,
        'inn': inn,
        'ogrn': ogrn,
        'legal_address': legal_address,
        'email': email,
        'password': hashed_password,
        'role': 'company'
    }
    
    companies_collection.insert_one(new_company)

    return jsonify({'message': 'Компания успешно зарегистрирована'}), 201
