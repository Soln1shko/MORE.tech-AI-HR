# ==============================================================================
# IMPORTS
# ==============================================================================
import io
import json
import base64
import asyncio
import tempfile
import os
import traceback
import time

# Imports for Web Server
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState

# Imports for Transcription
import whisper

# Imports for Voice Analysis
import numpy as np
import librosa

# ==============================================================================
# INITIALIZATION
# ==============================================================================

app = FastAPI()

# Load Whisper model
model_name = os.getenv("WHISPER_MODEL", "small").strip()
print(f"🤖 Загрузка модели Whisper '{model_name}'...")
model = whisper.load_model(model_name)
print(f"✅ Модель Whisper '{model_name}' загружена.")

# ==============================================================================
# VOICE ANALYSIS LOGIC (from voice_analyser.py)
# ==============================================================================

def extract_features(audio: np.ndarray, sr: int):
    """Извлечение акустических признаков из аудиоданных."""
    features = {}
    print("🔬 Начало извлечения акустических признаков...")
    try:
        # Энергетические характеристики
        energy = librosa.feature.rms(y=audio)[0]
        features['avg_energy'] = np.mean(energy)
        features['energy_std'] = np.std(energy)
        features['energy_stability'] = 1 / (np.std(energy) + 0.001)

        # Высота тона
        pitches, magnitudes = librosa.piptrack(y=audio, sr=sr)
        pitch_values = pitches[pitches > 0]
        if len(pitch_values) > 0:
            features['avg_pitch'] = np.mean(pitch_values)
            features['pitch_std'] = np.std(pitch_values)
            features['pitch_stability'] = 1 / (np.std(pitch_values) + 0.1)
        else:
            features['avg_pitch'] = 0
            features['pitch_std'] = 0
            features['pitch_stability'] = 0

        # Темп и речевая активность
        tempo, _ = librosa.beat.beat_track(y=audio, sr=sr)
        features['tempo'] = tempo[0] if isinstance(tempo, np.ndarray) and tempo.size > 0 else tempo

        silence_threshold = np.mean(energy) * 0.15
        speech_frames = np.sum(energy > silence_threshold)
        features['speech_ratio'] = speech_frames / len(energy) if len(energy) > 0 else 0.0

        # Спектральные характеристики
        spectral_centroids = librosa.feature.spectral_centroid(y=audio, sr=sr)[0]
        features['spectral_brightness'] = np.mean(spectral_centroids)
        features['brightness_stability'] = 1 / (np.std(spectral_centroids) + 0.1)
        
        print("👍 Признаки успешно извлечены.")

    except Exception as e:
        print(f"❌ Ошибка извлечения признаков: {e}")
        # Возвращаем базовые значения в случае ошибки
        return {
            'avg_energy': 0.01, 'energy_std': 0.01, 'energy_stability': 1,
            'avg_pitch': 100, 'pitch_std': 10, 'pitch_stability': 1,
            'tempo': 120, 'speech_ratio': 0.5, 'spectral_brightness': 2000,
            'brightness_stability': 1,
            'error': str(e)
        }
    return features


def features_to_tags(features: dict):
    """Преобразование признаков в теги софт-скиллов."""
    tags = []
    scores = {}
    print("🏷️ Преобразование признаков в теги...")
    
    # УВЕРЕННОСТЬ
    confidence = 0
    if features.get('energy_stability', 0) > 10: confidence += 0.3
    if features.get('pitch_stability', 0) > 5: confidence += 0.3
    if 0.6 <= features.get('speech_ratio', 0) <= 0.85: confidence += 0.2
    if 80 <= features.get('tempo', 120) <= 140: confidence += 0.2
    if confidence >= 0.6: tags.append("Уверенный")
    elif confidence >= 0.3: tags.append("Достаточно уверенный")
    else: tags.append("Неуверенный")
    scores['confidence'] = round(confidence * 100, 1)

    # СТРЕССОУСТОЙЧИВОСТЬ
    stress_resistance = 0
    if features.get('pitch_std', 100) < 50: stress_resistance += 0.4
    if features.get('energy_std', 1) < 0.02: stress_resistance += 0.3
    if 90 <= features.get('tempo', 120) <= 130: stress_resistance += 0.3
    if stress_resistance >= 0.6: tags.append("Стрессоустойчивый")
    elif stress_resistance >= 0.3: tags.append("Средняя стрессоустойчивость")
    else: tags.append("Подвержен стрессу")
    scores['stress_resistance'] = round(stress_resistance * 100, 1)

    # КОММУНИКАТИВНОСТЬ
    communication = 0
    if features.get('speech_ratio', 0) > 0.7: communication += 0.3
    if features.get('spectral_brightness', 0) > 2000: communication += 0.25
    if features.get('brightness_stability', 0) > 3: communication += 0.25
    if features.get('avg_energy', 0) > 0.03: communication += 0.2
    if communication >= 0.6: tags.append("Отличная коммуникация")
    elif communication >= 0.3: tags.append("Хорошая коммуникация")
    else: tags.append("Слабая коммуникация")
    scores['communication'] = round(communication * 100, 1)

    # ЭНЕРГИЧНОСТЬ
    energy_score = 0
    if features.get('avg_energy', 0) > 0.05: energy_score += 0.5
    if 110 <= features.get('tempo', 120) <= 160: energy_score += 0.5
    if energy_score >= 0.6: tags.append("Энергичный")
    elif energy_score >= 0.3: tags.append("Умеренно активный")
    else: tags.append("Пассивный")
    scores['energy'] = round(energy_score * 100, 1)

    # ДОПОЛНИТЕЛЬНЫЕ ТЕГИ
    if features.get('tempo', 120) > 150: tags.append("Быстрая речь")
    elif features.get('tempo', 120) < 80: tags.append("Медленная речь")
    if features.get('avg_energy', 0) < 0.02: tags.append("Тихий голос")
    elif features.get('avg_energy', 0) > 0.1: tags.append("Громкий голос")
    if features.get('pitch_std', 100) < 20: tags.append("Монотонный")
    
    # ОБЩАЯ ОЦЕНКА
    overall_score = (scores['confidence'] * 0.3 + scores['communication'] * 0.3 + scores['stress_resistance'] * 0.25 + scores['energy'] * 0.15)
    
    print("👍 Теги и оценки успешно сформированы.")
    
    return {
        'tags': list(set(tags)), # Убираем дубликаты
        'scores': scores,
        'overall_score': round(overall_score, 1)
    }

def analyze_audio_sync(audio_np: np.ndarray, sr: int):
    """Синхронная обертка для анализа аудио."""
    if audio_np.size == 0:
        print("⚠️ Попытка анализа пустого аудио массива.")
        return {
            'tags': ['Нет данных'],
            'scores': {},
            'error': 'Нет аудиоданных для анализа'
        }
    
    start_time = time.time()
    features = extract_features(audio_np, sr)
    analysis_result = features_to_tags(features)
    processing_time = (time.time() - start_time) * 1000
    
    analysis_result['meta'] = {
        'total_duration': round(len(audio_np) / sr, 2),
        'processing_time_ms': round(processing_time, 1)
    }
    return analysis_result


def transcribe_audio_sync(audio_np: np.ndarray):
    """Синхронная обертка для транскрипции."""
    if audio_np.size == 0:
        print("⚠️ Попытка транскрипции пустого аудио массива.")
        return "Пустой аудио файл"
        
    try:
        print(f"🤖 Запускаем Whisper для транскрипции...")
        start_time = time.time()
        result = model.transcribe(audio_np, language="ru")
        processing_time = time.time() - start_time
        print(f"🎯 Whisper завершил обработку за {processing_time:.2f}с")
        
        transcribed_text = result["text"].strip()
        
        if not transcribed_text:
            print("⚠️ Whisper вернул пустой текст")
            return "Не удалось распознать речь"
            
        return transcribed_text
    except Exception as e:
        print(f"❌ Ошибка Whisper/FFmpeg: {e}")
        return "Извините, возникли технические проблемы с распознаванием речи. Попробуйте записать ответ еще раз."

# ==============================================================================
# WEBSOCKET LOGIC
# ==============================================================================

@app.websocket("/ws/voice")
async def websocket_voice(websocket: WebSocket):
    print("🔗 Новое WebSocket подключение")
    await websocket.accept()
    print("✅ WebSocket соединение принято")
    
    audio_buffer = io.BytesIO()
    chunks_received = 0
    
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            if message['type'] == 'audio_chunk':
                chunk_b64 = message['data']
                chunk_bytes = base64.b64decode(chunk_b64)
                audio_buffer.write(chunk_bytes)
                chunks_received += 1
                
                if chunks_received % 20 == 0:
                    print(f"🎵 Получено {chunks_received} чанков, общий размер: {audio_buffer.tell()} байт")

            elif message['type'] == 'end':
                print("🏁 Получен сигнал завершения записи.")
                print(f"📈 Всего получено чанков: {chunks_received}")
                
                audio_bytes = audio_buffer.getvalue()
                
                if len(audio_bytes) == 0:
                    print("⚠️ Получено пустое аудио. Отправляем ошибку клиенту.")
                    if websocket.application_state == WebSocketState.CONNECTED:
                        await websocket.send_json({'type': 'error', 'message': 'Аудиозапись пуста.'})
                    continue # Ждем следующую запись

                print(f"🎧 Начинаем обработку аудио размером {len(audio_bytes)} байт")
                loop = asyncio.get_event_loop()
                
                # Создаем временный файл для декодирования
                temp_audio_file = tempfile.NamedTemporaryFile(suffix=".webm", delete=False)
                temp_file_path = temp_audio_file.name
                
                try:
                    temp_audio_file.write(audio_bytes)
                    temp_audio_file.close()
                    print(f"💾 Аудио данные записаны во временный файл: {temp_file_path}")

                    # Декодируем аудио в numpy array с помощью librosa
                    # Это CPU-bound операция, но librosa.load быстрая для небольших файлов
                    print("🔄 Декодирование аудио файла в numpy array...")
                    start_decode = time.time()
                    audio_np, sr = librosa.load(temp_file_path, sr=16000, mono=True)
                    print(f"✅ Аудио декодировано за {time.time() - start_decode:.2f}с. Сэмплов: {len(audio_np)}, Частота: {sr}Hz")

                    # Параллельный запуск транскрипции и анализа в отдельных потоках
                    print("🚀 Запускаем транскрипцию и анализ параллельно...")
                    transcribe_task = loop.run_in_executor(None, transcribe_audio_sync, audio_np)
                    analyze_task = loop.run_in_executor(None, analyze_audio_sync, audio_np, sr)
                    
                    # Ожидаем результаты
                    transcription_result = await transcribe_task
                    analysis_result = await analyze_task
                    
                    print(f"📝 Результат транскрипции: '{transcription_result}'")
                    print(f"📊 Результат анализа: {analysis_result['tags']}")
                    
                    if websocket.application_state == WebSocketState.CONNECTED:
                        response = {
                            'type': 'final_result',
                            'transcription': transcription_result,
                            'analysis': analysis_result
                        }
                        print(f"📤 Отправляем результат клиенту...")
                        await websocket.send_json(response)
                        print("✅ Результат успешно отправлен")
                    else:
                        print("❌ WebSocket не подключен, не можем отправить результат")

                finally:
                    # Удаляем временный файл
                    if os.path.exists(temp_file_path):
                        os.unlink(temp_file_path)
                        print(f"🗑️ Временный файл удален: {temp_file_path}")

                # Сброс для следующей записи
                audio_buffer = io.BytesIO()
                chunks_received = 0
                print("\n🔄 Буфер сброшен, готов к новой записи.")

    except WebSocketDisconnect:
        print("🔌 Клиент отключился от WebSocket.")
    except Exception as e:
        print(f"❌ Критическая ошибка в WebSocket: {e}")
        traceback.print_exc()
    finally:
        # Убедимся, что буфер закрыт
        if not audio_buffer.closed:
            audio_buffer.close()


# ==============================================================================
# MAIN EXECUTION
# ==============================================================================

if __name__ == "__main__":
    import uvicorn
    print("🚀 Запуск сервера Uvicorn на http://0.0.0.0:8001")
    uvicorn.run(app, host="0.0.0.0", port=8001, reload=False)
