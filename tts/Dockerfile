# TTS (Coqui) FastAPI Dockerfile
FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Accept Coqui CPML/ToS non-interactively for XTTSv2
ENV COQUI_TOS_AGREED=1 \
    COQUI_TTS_LICENSE_AGREED=1

# System deps
RUN apt-get update && apt-get install -y build-essential libsndfile1 ffmpeg && rm -rf /var/lib/apt/lists/*

# Copy sources
COPY . /app

# Install deps (CPU Torch first)
RUN pip install --upgrade pip \
    && pip install --index-url https://download.pytorch.org/whl/cpu torch==2.5.1 torchvision==0.20.1 torchaudio==2.5.1 \
    && pip install -r requirements.txt

EXPOSE 8003

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8003"]
