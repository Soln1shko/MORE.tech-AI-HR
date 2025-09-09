import os
import re
from flask import current_app

def safe_filename(filename):
    """
    Создает безопасное имя файла с поддержкой кириллицы.
    Транслитерирует русские символы в латиницу и удаляет небезопасные символы.
    """
    if not filename:
        return 'unnamed_file'
    
    # Словарь для транслитерации русских символов
    translit_dict = {
        'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
        'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
        'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
        'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch',
        'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
        'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'E', 'Ё': 'Yo',
        'Ж': 'Zh', 'З': 'Z', 'И': 'I', 'Й': 'Y', 'К': 'K', 'Л': 'L', 'М': 'M',
        'Н': 'N', 'О': 'O', 'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T', 'У': 'U',
        'Ф': 'F', 'Х': 'H', 'Ц': 'Ts', 'Ч': 'Ch', 'Ш': 'Sh', 'Щ': 'Sch',
        'Ъ': '', 'Ы': 'Y', 'Ь': '', 'Э': 'E', 'Ю': 'Yu', 'Я': 'Ya'
    }
    
    # Разделяем имя файла и расширение
    name, ext = os.path.splitext(filename)
    
    # Транслитерируем русские символы
    transliterated = ''
    for char in name:
        if char in translit_dict:
            transliterated += translit_dict[char]
        else:
            transliterated += char
    
    # Удаляем небезопасные символы, оставляем только буквы, цифры, дефисы и подчеркивания
    safe_name = re.sub(r'[^\w\-_]', '_', transliterated)
    
    # Убираем множественные подчеркивания
    safe_name = re.sub(r'_+', '_', safe_name)
    
    # Убираем подчеркивания в начале и конце
    safe_name = safe_name.strip('_')
    
    # Если имя пустое, используем fallback
    if not safe_name:
        safe_name = 'unnamed_file'
    
    # Ограничиваем длину имени файла
    if len(safe_name) > 100:
        safe_name = safe_name[:100]
    
    return safe_name + ext.lower()
def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in current_app.config['ALLOWED_EXTENSIONS']