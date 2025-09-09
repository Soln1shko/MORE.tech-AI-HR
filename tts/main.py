import io
import wave
import json
import os
import urllib.request
import torch
import numpy as np

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from TTS.api import TTS

# --- 1. Настройка и загрузка модели TTS ---

print(" > Определение устройства...")
device = "cuda" if torch.cuda.is_available() else "cpu"
print(f" > Используется устройство: {device}")

print(" > Загрузка модели XTTSv2...")
# Загружаем модель TTS один раз при запуске приложения
tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to(device)
print(" > Модель успешно загружена.")

# --- 2. Подготовка образца голоса для клонирования ---

speaker_wav_path = "audio_2025-09-07_22-16-31.wav"

# Проверяем, существует ли файл, и если нет - скачиваем его
if not os.path.exists(speaker_wav_path):
    print(f" > Файл '{speaker_wav_path}' не найден. Скачиваем образец голоса...")
    # Ссылка на официальный образец голоса от Coqui TTS
    url = "https://github.com/coqui-ai/TTS/raw/main/tests/data/ljspeech/wavs/LJ001-0001.wav"
    urllib.request.urlretrieve(url, speaker_wav_path)
    print(" > Скачивание завершено.")

print(f"\n > Используем образец голоса: {speaker_wav_path}")

# --- 3. Настройка FastAPI приложения ---

app = FastAPI(title='TTS FastAPI App')

# Определяем реальную частоту дискретизации модели
# Модель XTTSv2 работает на 24000Hz
model_sample_rate = tts.synthesizer.output_sample_rate 

@app.websocket("/ws/speak")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    print("WebSocket-клиент подключен.")
    try:
        while True:
            # Ожидаем сообщение от клиента в формате JSON {"text": "Привет, мир!"}
            data_str = await websocket.receive_text()
            data = json.loads(data_str)

            text_to_speak = data.get("text", "")
            
            # Параметры speaker и sample_rate от клиента игнорируются,
            # так как мы используем фиксированный speaker_wav и sample_rate модели.

            if not text_to_speak:
                continue

            print(f'WebSocket получил запрос: text="{text_to_speak}"')

            # --- 4. Синтез речи с использованием новой модели ---
            # tts.tts() возвращает аудио как список float значений
            wav_list = tts.tts(
                text=text_to_speak,
                speaker_wav=speaker_wav_path,
                language='ru'
            )
            
            # Конвертируем список float в 16-bit PCM numpy массив, а затем в байты
            wav_numpy = np.array(wav_list, dtype=np.float32)
            audio_data = (wav_numpy * 32767).astype(np.int16).tobytes()

            # Упаковываем аудио в формат WAV в памяти
            f = io.BytesIO()
            with wave.open(f, 'w') as wav_file_in_memory:
                wav_file_in_memory.setnchannels(1)  # mono
                wav_file_in_memory.setsampwidth(2)  # 16-bit
                wav_file_in_memory.setframerate(model_sample_rate) # Используем частоту модели
                wav_file_in_memory.writeframes(audio_data)
            
            wav_bytes = f.getvalue()

            # Отправляем WAV-файл в виде байтов клиенту
            await websocket.send_bytes(wav_bytes)
            print(f"Аудиоданные ({len(wav_bytes)} байт) отправлены клиенту.")

    except WebSocketDisconnect:
        print("WebSocket-клиент отключился.")
    except Exception as e:
        print(f"Произошла ошибка в WebSocket: {e}")
        # Можно отправить сообщение об ошибке клиенту
        await websocket.close(code=1011, reason=f"Internal Server Error: {e}")

# --- 5. Запуск сервера ---

if __name__ == "__main__":
    import uvicorn
    # Запускаем приложение с помощью Uvicorn на порту 8003
    # host="0.0.0.0" делает сервер доступным в локальной сети
    uvicorn.run(app, host="0.0.0.0", port=8003)