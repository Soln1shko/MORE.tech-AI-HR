"""Веб-сервис для приёма голосовых ответов и анализа речи.

Реализует WebSocket-эндпоинт для приёма аудио-чанков, их транскрипцию
с помощью Whisper и извлечение акустических признаков (librosa) с
преобразованием в теги, описывающие soft-skills.
"""

import io
import json
import base64
import asyncio
import tempfile
import os
import traceback
import time
import logging
from typing import Any, Dict

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState

import whisper

import numpy as np
import librosa

app = FastAPI()

logger = logging.getLogger(__name__)

logger.info("Загрузка модели Whisper: small")
model = whisper.load_model("small")
logger.info("Модель Whisper 'small' загружена")

def extract_features(audio: np.ndarray, sr: int) -> Dict[str, float]:
    """Извлекает базовые акустические признаки из одномерного аудиосигнала.

    Args:
        audio: Аудиосигнал (моно) как numpy.ndarray (float32/float64).
        sr: Частота дискретизации аудио.

    Returns:
        Словарь численных признаков: энергия, стабильности, высота тона,
        темп, отношение речевых кадров, спектральная «яркость».
    """
    features = {}
    logger.debug("Начало извлечения акустических признаков")
    try:
        energy = librosa.feature.rms(y=audio)[0]
        features['avg_energy'] = np.mean(energy)
        features['energy_std'] = np.std(energy)
        features['energy_stability'] = 1 / (np.std(energy) + 0.001)

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

        tempo, _ = librosa.beat.beat_track(y=audio, sr=sr)
        features['tempo'] = float(tempo[0]) if isinstance(tempo, np.ndarray) and tempo.size > 0 else float(tempo)

        silence_threshold = np.mean(energy) * 0.15
        speech_frames = np.sum(energy > silence_threshold)
        features['speech_ratio'] = speech_frames / len(energy) if len(energy) > 0 else 0.0

        spectral_centroids = librosa.feature.spectral_centroid(y=audio, sr=sr)[0]
        features['spectral_brightness'] = np.mean(spectral_centroids)
        features['brightness_stability'] = 1 / (np.std(spectral_centroids) + 0.1)
        
    except Exception as e:
        logger.exception("Ошибка извлечения акустических признаков")
        return {
            'avg_energy': 0.01, 'energy_std': 0.01, 'energy_stability': 1,
            'avg_pitch': 100, 'pitch_std': 10, 'pitch_stability': 1,
            'tempo': 120, 'speech_ratio': 0.5, 'spectral_brightness': 2000,
            'brightness_stability': 1,
            'error': str(e)
        }
    return features


def features_to_tags(features: Dict[str, float]) -> Dict[str, Any]:
    """Преобразует набор акустических признаков в теги и оценки.

    Args:
        features: Словарь с извлеченными численными признаками.

    Returns:
        Структура с тегами, промежуточными оценками и сводной метрикой.
    """
    tags = []
    scores = {}
    logger.debug("Преобразование признаков в теги")
    
    confidence = 0
    if features.get('energy_stability', 0) > 10: confidence += 0.3
    if features.get('pitch_stability', 0) > 5: confidence += 0.3
    if 0.6 <= features.get('speech_ratio', 0) <= 0.85: confidence += 0.2
    if 80 <= features.get('tempo', 120) <= 140: confidence += 0.2
    if confidence >= 0.6: tags.append("Уверенный")
    elif confidence >= 0.3: tags.append("Достаточно уверенный")
    else: tags.append("Неуверенный")
    scores['confidence'] = round(confidence * 100, 1)

    stress_resistance = 0
    if features.get('pitch_std', 100) < 50: stress_resistance += 0.4
    if features.get('energy_std', 1) < 0.02: stress_resistance += 0.3
    if 90 <= features.get('tempo', 120) <= 130: stress_resistance += 0.3
    if stress_resistance >= 0.6: tags.append("Стрессоустойчивый")
    elif stress_resistance >= 0.3: tags.append("Средняя стрессоустойчивость")
    else: tags.append("Подвержен стрессу")
    scores['stress_resistance'] = round(stress_resistance * 100, 1)

    communication = 0
    if features.get('speech_ratio', 0) > 0.7: communication += 0.3
    if features.get('spectral_brightness', 0) > 2000: communication += 0.25
    if features.get('brightness_stability', 0) > 3: communication += 0.25
    if features.get('avg_energy', 0) > 0.03: communication += 0.2
    if communication >= 0.6: tags.append("Отличная коммуникация")
    elif communication >= 0.3: tags.append("Хорошая коммуникация")
    else: tags.append("Слабая коммуникация")
    scores['communication'] = round(communication * 100, 1)

    energy_score = 0
    if features.get('avg_energy', 0) > 0.05: energy_score += 0.5
    if 110 <= features.get('tempo', 120) <= 160: energy_score += 0.5
    if energy_score >= 0.6: tags.append("Энергичный")
    elif energy_score >= 0.3: tags.append("Умеренно активный")
    else: tags.append("Пассивный")
    scores['energy'] = round(energy_score * 100, 1)

    if features.get('tempo', 120) > 150: tags.append("Быстрая речь")
    elif features.get('tempo', 120) < 80: tags.append("Медленная речь")
    if features.get('avg_energy', 0) < 0.02: tags.append("Тихий голос")
    elif features.get('avg_energy', 0) > 0.1: tags.append("Громкий голос")
    if features.get('pitch_std', 100) < 20: tags.append("Монотонный")
    
    overall_score = (scores['confidence'] * 0.3 + scores['communication'] * 0.3 + scores['stress_resistance'] * 0.25 + scores['energy'] * 0.15)
    
    logger.debug("Теги и оценки успешно сформированы")
    
    return {
        'tags': list(set(tags)),
        'scores': scores,
        'overall_score': round(overall_score, 1)
    }

def analyze_audio_sync(audio_np: np.ndarray, sr: int) -> Dict[str, Any]:
    """Синхронно анализирует аудиосигнал и формирует теги.

    Args:
        audio_np: Аудиосигнал (моно) в numpy.ndarray.
        sr: Частота дискретизации.

    Returns:
        Структура с тегами, оценками и метаданными по обработке.
    """
    if audio_np.size == 0:
        logger.warning("Попытка анализа пустого аудио массива")
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


def transcribe_audio_sync(audio_np: np.ndarray) -> str:
    """Синхронно транскрибирует аудиосигнал с помощью Whisper.

    Args:
        audio_np: Аудиосигнал (моно) в numpy.ndarray.

    Returns:
        Распознанный текст. В случае ошибки — диагностическая строка.
    """
    if audio_np.size == 0:
        logger.warning("Попытка транскрипции пустого аудио массива")
        return "Пустой аудио файл"
        
    try:
        logger.info("Запуск Whisper для транскрипции")
        start_time = time.time()
        result = model.transcribe(audio_np, language="ru")
        processing_time = time.time() - start_time
        logger.info(f"Whisper завершил обработку за {processing_time:.2f}с")
        
        transcribed_text = result["text"].strip()
        
        if not transcribed_text:
            logger.warning("Whisper вернул пустой текст")
            return "Не удалось распознать речь"
            
        return transcribed_text
    except Exception as e:
        logger.exception("Ошибка Whisper/FFmpeg")
        return "Извините, возникли технические проблемы с распознаванием речи. Попробуйте записать ответ еще раз."

@app.websocket("/ws/voice")
async def websocket_voice(websocket: WebSocket) -> None:
    """Обрабатывает голосовую сессию по WebSocket.

    Ожидает текстовые сообщения JSON вида:
    - {"type": "audio_chunk", "data": <base64-строка>}
    - {"type": "end"}

    По сигналу "end" выполняет транскрипцию и анализ, возвращая JSON с полями
    `transcription` и `analysis`.
    """
    logger.info("Новое WebSocket подключение")
    await websocket.accept()
    logger.info("WebSocket соединение принято")
    
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
                    logger.debug(f"Получено {chunks_received} чанков, общий размер: {audio_buffer.tell()} байт")

            elif message['type'] == 'end':
                logger.info("Получен сигнал завершения записи")
                logger.debug(f"Всего получено чанков: {chunks_received}")
                
                audio_bytes = audio_buffer.getvalue()
                
                if len(audio_bytes) == 0:
                    logger.warning("Получено пустое аудио. Отправляем ошибку клиенту")
                    if websocket.application_state == WebSocketState.CONNECTED:
                        await websocket.send_json({'type': 'error', 'message': 'Аудиозапись пуста.'})
                    continue

                logger.info(f"Начинаем обработку аудио размером {len(audio_bytes)} байт")
                loop = asyncio.get_event_loop()
                
                temp_audio_file = tempfile.NamedTemporaryFile(suffix=".webm", delete=False)
                temp_file_path = temp_audio_file.name
                
                try:
                    temp_audio_file.write(audio_bytes)
                    temp_audio_file.close()
                    logger.debug(f"Аудио данные записаны во временный файл: {temp_file_path}")

                    logger.debug("Декодирование аудио файла в numpy array")
                    start_decode = time.time()
                    audio_np, sr = librosa.load(temp_file_path, sr=16000, mono=True)
                    logger.info(f"Аудио декодировано за {time.time() - start_decode:.2f}с. Сэмплов: {len(audio_np)}, Частота: {sr}Hz")

                    logger.info("Запуск транскрипции и анализа параллельно")
                    transcribe_task = loop.run_in_executor(None, transcribe_audio_sync, audio_np)
                    analyze_task = loop.run_in_executor(None, analyze_audio_sync, audio_np, sr)
                    
                    transcription_result = await transcribe_task
                    analysis_result = await analyze_task
                    
                    logger.debug(f"Результат транскрипции: '{transcription_result}'")
                    logger.debug(f"Результат анализа: {analysis_result['tags']}")
                    
                    if websocket.application_state == WebSocketState.CONNECTED:
                        response = {
                            'type': 'final_result',
                            'transcription': transcription_result,
                            'analysis': analysis_result
                        }
                        logger.debug("Отправляем результат клиенту")
                        await websocket.send_json(response)
                        logger.info("Результат успешно отправлен")
                    else:
                        logger.warning("WebSocket не подключен, не можем отправить результат")

                finally:
                    if os.path.exists(temp_file_path):
                        os.unlink(temp_file_path)
                        logger.debug(f"Временный файл удален: {temp_file_path}")

                audio_buffer = io.BytesIO()
                chunks_received = 0
                logger.debug("Буфер сброшен, готов к новой записи")

    except WebSocketDisconnect:
        logger.info("Клиент отключился от WebSocket")
    except Exception as e:
        logger.exception("Критическая ошибка в WebSocket")
    finally:
        if not audio_buffer.closed:
            audio_buffer.close()


if __name__ == "__main__":
    import uvicorn
    logger.info("Запуск сервера Uvicorn на http://0.0.0.0:8001")
    uvicorn.run(app, host="0.0.0.0", port=8001, reload=True)
