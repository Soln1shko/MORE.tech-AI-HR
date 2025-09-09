import logging
import os
from datetime import datetime

import boto3
from botocore.exceptions import ClientError
from dotenv import load_dotenv

# Загрузка переменных окружения из .env файла
load_dotenv()

# Настройка логирования для вывода информации в консоль
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Получение настроек из переменных окружения
YC_SA_KEY_ID = os.getenv('YC_SA_KEY_ID')
YC_SA_SECRET_KEY = os.getenv('YC_SA_SECRET_KEY')
YC_STORAGE_BUCKET = os.getenv('YC_STORAGE_BUCKET')
YC_ENDPOINT_URL = os.getenv('YC_ENDPOINT_URL', 'https://storage.yandexcloud.net')


def create_s3_session():
    """
    Создает и настраивает сессию для работы с Yandex Object Storage.
    """
    try:
        session = boto3.session.Session(
            aws_access_key_id=YC_SA_KEY_ID,
            aws_secret_access_key=YC_SA_SECRET_KEY,
            region_name="ru-central1"
        )
        s3_client = session.client(
            service_name='s3',
            endpoint_url=YC_ENDPOINT_URL
        )
        return s3_client
    except Exception as e:
        logging.error(f"Не удалось создать сессию S3: {e}")
        return None


def upload_document_to_s3(s3_client, file_path, bucket_name):
    """
    Загружает файл (PDF, DOC, DOCX) в Yandex Object Storage (S3).
    """
    # 1. Проверка наличия учетных данных
    if not YC_SA_KEY_ID or not YC_SA_SECRET_KEY or not bucket_name:
        logging.error("Учетные данные (ID, ключ, имя бакета) не найдены в .env файле.")
        return False

    # 2. Проверка, существует ли файл локально
    if not os.path.exists(file_path):
        logging.error(f"Файл для загрузки не найден: {file_path}")
        return False

    # 3. Проверка на допустимое расширение файла
    allowed_extensions = ['.pdf', '.doc', '.docx']
    file_name = os.path.basename(file_path)
    file_ext = os.path.splitext(file_name)[1].lower()

    if file_ext not in allowed_extensions:
        logging.warning(f"Неподдерживаемый тип файла: {file_ext}. Допускаются только: {allowed_extensions}")
        return False

    # 4. Формирование имени объекта в бакете: /documents/имя_файла.расширение
    object_name = f"documents/{file_name}"

    # 5. Загрузка файла
    try:
        logging.info(f"Начало загрузки {file_path} в бакет {bucket_name} как {object_name}...")
        s3_client.upload_file(file_path, bucket_name, object_name)
        logging.info("Файл успешно загружен.")
        return True
    except ClientError as e:
        logging.error(f"Ошибка при загрузке файла в S3: {e}")
        return False


def upload_file_object_to_s3(s3_client, file_object, filename, bucket_name):
    """
    Загружает файловый объект (из Flask request.files) в Yandex Object Storage.
    """
    # 1. Проверка наличия учетных данных
    if not YC_SA_KEY_ID or not YC_SA_SECRET_KEY or not bucket_name:
        logging.error("Учетные данные (ID, ключ, имя бакета) не найдены в .env файле.")
        return False, None

    # 2. Проверка на допустимое расширение файла
    allowed_extensions = ['.pdf', '.doc', '.docx']
    file_ext = os.path.splitext(filename)[1].lower()

    if file_ext not in allowed_extensions:
        logging.warning(f"Неподдерживаемый тип файла: {file_ext}. Допускаются только: {allowed_extensions}")
        return False, None

    # 3. Формирование имени объекта в бакете: /resumes/имя_файла.расширение
    object_name = f"resumes/{filename}"

    # 4. Загрузка файла
    try:
        logging.info(f"Начало загрузки {filename} в бакет {bucket_name} как {object_name}...")
        
        # Возвращаем указатель файла в начало (на случай, если он уже читался)
        file_object.seek(0)
        
        # Загружаем файловый объект напрямую
        s3_client.upload_fileobj(file_object, bucket_name, object_name)
        
        # Формируем URL файла
        file_url = f"{YC_ENDPOINT_URL}/{bucket_name}/{object_name}"
        
        logging.info(f"Файл успешно загружен. URL: {file_url}")
        return True, file_url
    except ClientError as e:
        logging.error(f"Ошибка при загрузке файла в S3: {e}")
        return False, None


def main():
    """
    Основная функция для демонстрации загрузки файлов.
    """
    s3_client = create_s3_session()
    if not s3_client:
        logging.error("Выход из программы: не удалось создать S3 клиент.")
        return

    # --- Пример использования ---
    # Используем путь к файлу в текущей директории скрипта
    script_dir = os.path.dirname(os.path.abspath(__file__))
    files_to_upload = [
        os.path.join(script_dir, "Резюме.docx"),
    ]


    # Загрузка каждого файла по очереди
    for file_path in files_to_upload:
        print("-" * 30)
        upload_document_to_s3(s3_client, file_path, YC_STORAGE_BUCKET)
    
    print("-" * 30)
    print("Работа завершена.")


if __name__ == "__main__":
    main()
