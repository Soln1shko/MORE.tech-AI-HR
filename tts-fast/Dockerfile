# TTS FastAPI Dockerfile
FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# System deps
RUN apt-get update && apt-get install -y build-essential libsndfile1 ffmpeg && rm -rf /var/lib/apt/lists/*

# Copy sources
COPY . /app

# Install deps
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

EXPOSE 8003

CMD ["python", "main.py"]
