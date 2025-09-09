# Backend (Flask) Dockerfile
FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# System deps
RUN apt-get update && apt-get install -y build-essential && rm -rf /var/lib/apt/lists/*

# Copy sources
COPY . /app

# Install deps
RUN pip install  --upgrade pip \
    && pip install \
        Flask==3.0.3 \
        flask-cors==4.0.1 \
        pymongo==4.10.1 \
        python-dotenv==1.0.1 \
        requests==2.32.3 \
        boto3==1.35.71 \
        PyPDF2==3.0.1 \
        python-docx==1.1.2 \
        bcrypt==4.2.0 \
        PyJWT==2.9.0

EXPOSE 5000

CMD ["python", "run.py"]
