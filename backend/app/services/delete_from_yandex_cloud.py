import logging
import os
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
    """Создает и настраивает сессию для работы с Yandex Object Storage."""
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


def delete_file_from_s3(s3_client, bucket_name, object_name):
    """Удаляет файл из Yandex Object Storage (S3)."""
    if not YC_SA_KEY_ID or not YC_SA_SECRET_KEY or not bucket_name:
        logging.error("Учетные данные не найдены в .env файле.")
        return False

    try:
        logging.info(f"Начало удаления объекта {object_name} из бакета {bucket_name}...")
        # Проверяем, существует ли объект, перед удалением
        s3_client.head_object(Bucket=bucket_name, Key=object_name)
        # Если проверка прошла, удаляем объект
        s3_client.delete_object(Bucket=bucket_name, Key=object_name)
        logging.info(f"Объект {object_name} успешно удален.")
        return True
    except ClientError as e:
        # Если head_object возвращает ошибку 404, значит файла и так нет
        if e.response['Error']['Code'] == '404':
            logging.warning(f"Объект {object_name} не найден в бакете. Удаление не требуется.")
            return True
        else:
            logging.error(f"Ошибка при удалении объекта из S3: {e}")
            return False


def main():
    """
    Основная функция для демонстрации загрузки и последующего удаления файла.
    """
    s3_client = create_s3_session()
    if not s3_client:
        logging.error("Выход из программы: не удалось создать S3 клиент.")
        return

    # --- Общие переменные для демонстрации ---
    script_dir = os.path.dirname(os.path.abspath(__file__))
    local_file_name = "adievmrt@gmail.com_1.docx"
    file_to_upload = os.path.join(script_dir, local_file_name)
    # Имя объекта в S3. Используем папку 'resumes' как в вашем примере.
    object_name_in_s3 = f"resumes/{local_file_name}"
    
    # --- 3. Удаление файла ---
    print("\n--- ДЕМОНСТРАЦИЯ УДАЛЕНИЯ ---")
    delete_file_from_s3(
        s3_client=s3_client,
        bucket_name=YC_STORAGE_BUCKET,
        object_name=object_name_in_s3
    )
    
    print("-" * 30)
    print("Работа завершена.")


if __name__ == "__main__":
    main()
