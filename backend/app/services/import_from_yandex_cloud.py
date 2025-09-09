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
    if not YC_SA_KEY_ID or not YC_SA_SECRET_KEY or not bucket_name:
        logging.error("Учетные данные (ID, ключ, имя бакета) не найдены в .env файле.")
        return False
    
    if not os.path.exists(file_path):
        logging.error(f"Файл для загрузки не найден: {file_path}")
        return False

    allowed_extensions = ['.pdf', '.doc', '.docx']
    file_name = os.path.basename(file_path)
    file_ext = os.path.splitext(file_name)[1].lower()

    if file_ext not in allowed_extensions:
        logging.warning(f"Неподдерживаемый тип файла: {file_ext}. Допускаются только: {allowed_extensions}")
        return False

    object_name = f"documents/{file_name}"

    try:
        logging.info(f"Начало загрузки {file_path} в бакет {bucket_name} как {object_name}...")
        s3_client.upload_file(file_path, bucket_name, object_name)
        logging.info("Файл успешно загружен.")
        return True
    except ClientError as e:
        logging.error(f"Ошибка при загрузке файла в S3: {e}")
        return False

def download_file_from_s3(s3_client, bucket_name, object_name, local_file_path):
    """
    Скачивает файл из Yandex Object Storage (S3).

    :param s3_client: Клиент boto3 для работы с S3.
    :param bucket_name: Имя бакета.
    :param object_name: Имя (ключ) объекта в бакете. Например, 'documents/file.docx'.
    :param local_file_path: Путь для сохранения файла на локальном диске.
    :return: True, если скачивание успешно, иначе False.
    """
    if not YC_SA_KEY_ID or not YC_SA_SECRET_KEY or not bucket_name:
        logging.error("Учетные данные (ID, ключ, имя бакета) не найдены в .env файле.")
        return False

    local_dir = os.path.dirname(local_file_path)
    if local_dir and not os.path.exists(local_dir):
        try:
            os.makedirs(local_dir)
            logging.info(f"Создана директория: {local_dir}")
        except OSError as e:
            logging.error(f"Не удалось создать директорию {local_dir}: {e}")
            return False

    try:
        logging.info(f"Начало скачивания объекта {object_name} из бакета {bucket_name}...")
        s3_client.download_file(bucket_name, object_name, local_file_path)
        logging.info(f"Файл успешно сохранен в: {local_file_path}")
        return True
    except ClientError as e:
        if e.response['Error']['Code'] == '404':
            logging.error(f"Объект не найден в бакете: {object_name}")
        else:
            logging.error(f"Ошибка при скачивании файла из S3: {e}")
        return False

def main():
    """
    Основная функция для демонстрации загрузки файлов.
    """
    s3_client = create_s3_session()
    if not s3_client:
        logging.error("Выход из программы: не удалось создать S3 клиент.")
    else:
        # --- Пример загрузки файла ---
        print("--- ДЕМОНСТРАЦИЯ ЗАГРУЗКИ ---")
        script_dir = os.path.dirname(os.path.abspath(__file__))
        file_to_upload = os.path.join(script_dir, "Резюме.docx")
        
        if os.path.exists(file_to_upload):
            upload_document_to_s3(s3_client, file_to_upload, YC_STORAGE_BUCKET)
        else:
            logging.warning(f"Файл для загрузки не найден: {file_to_upload}. Создаю пустой файл для теста.")
            open(file_to_upload, 'a').close()
            upload_document_to_s3(s3_client, file_to_upload, YC_STORAGE_BUCKET)

        print("-" * 30)

        # --- Пример скачивания файла ---
        print("--- ДЕМОНСТРАЦИЯ СКАЧИВАНИЯ ---")
        
        object_name_to_download = "documents/Резюме.docx" 
        local_download_path = os.path.join(script_dir, "downloads", "скачанное_резюме.docx")

        download_file_from_s3(
            s3_client=s3_client,
            bucket_name=YC_STORAGE_BUCKET,
            object_name=object_name_to_download,
            local_file_path=local_download_path
        )
        
        print("-" * 30)
        print("Работа завершена.")

if __name__ == "__main__":
    main()
