from functools import wraps
from flask import request, jsonify, current_app
import jwt
from bson import ObjectId
from ..core.database import users_collection, companies_collection 

def roles_required(*roles):
    def wrapper(f):
        @wraps(f)
        def decorated_function(caller_identity, *args, **kwargs):
            user_role = caller_identity.get('role')
            if user_role not in roles:
                return jsonify({'message': 'Недостаточно прав доступа!'}), 403 
            return f(caller_identity, *args, **kwargs)
        return decorated_function
    return wrapper

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('x-access-token')
        if not token:
            return jsonify({'message': 'Токен отсутствует!'}), 401
        try:
            data = jwt.decode(token, current_app.config['SECRET_KEY'], algorithms=["HS256"])
            account_id = data['account_id']
            role = data['role']
            
            # Ищем аккаунт в нужной коллекции в зависимости от роли
            if role == 'company':
                current_account = companies_collection.find_one({'_id': ObjectId(account_id)})
            else:
                current_account = users_collection.find_one({'_id': ObjectId(account_id)})

            if not current_account:
                return jsonify({'message': 'Аккаунт не найден!'}), 404
            
            # Передаем декодированные данные дальше
            # Это безопаснее, чем передавать весь объект из БД
            caller_identity = {'id': account_id, 'role': role}

        except Exception as e:
            return jsonify({'message': 'Токен недействителен!', 'error': str(e)}), 401
        
        return f(caller_identity, *args, **kwargs)
    return decorated