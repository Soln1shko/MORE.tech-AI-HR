# app/__init__.py
from flask import Flask, request
from flask_cors import CORS
from config import Config
import logging
from .logging_config import setup_logging

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    # Инициализация логирования
    setup_logging()
    logger = logging.getLogger("flask.app")

    CORS(app, origins="*", expose_headers=['Content-Disposition'])

    # Логирование запросов и ответов
    @app.before_request
    def _log_request():
        logger.info(
            f"Incoming request: {request.method} {request.path} | args={dict(request.args)}"
        )

    @app.after_request
    def _log_response(response):
        logger.info(
            f"Response: {request.method} {request.path} -> {response.status_code}"
        )
        return response

    @app.errorhandler(Exception)
    def _handle_exception(exc):
        logger.exception(f"Unhandled exception on {request.method} {request.path}: {exc}")
        return {"message": "Internal Server Error"}, 500

    # Регистрация Blueprints (маршрутов)
    from .auth.routes import auth_bp
    from .users.routes import users_bp
    from .companies.routes import companies_bp
    from .company_profile.routes import company_profile_bp
    from .vacancies.routes import vacancies_bp
    from .interviews.routes import interviews_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(users_bp)
    app.register_blueprint(companies_bp)
    app.register_blueprint(company_profile_bp)
    app.register_blueprint(vacancies_bp)
    app.register_blueprint(interviews_bp)

    return app
