import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.getenv('SECRET_KEY', 'default-secret-key')
    UPLOAD_FOLDER = 'uploads/resumes'
    ALLOWED_EXTENSIONS = {'pdf', 'doc', 'docx'}
    YC_STORAGE_BUCKET = os.getenv('YC_STORAGE_BUCKET')
    MONGO_URI = os.getenv('MONGO_URI') 
    AI_HR_SERVICE_URL = os.getenv('AI_HR_SERVICE_URL', 'http://127.0.0.1:8002')
    OPENROUTER_API_KEY = os.getenv('OPENROUTER_API_KEY')
