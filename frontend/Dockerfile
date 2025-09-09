# ================================================
# 🚀 MoreTech.VTB Frontend - Docker Configuration
# ================================================
# 
# Современный React + TypeScript + Vite фронтенд
# с Tailwind CSS и темной темой glassmorphism
#
# Архитектура: Multi-stage build для оптимизации размера
# Сервер: Nginx для production-ready развертывания
# ================================================

# ================================================
# 📦 STAGE 1: BUILD - Сборка приложения
# ================================================
FROM node:20-alpine AS builder

# Устанавливаем рабочую директорию
WORKDIR /app

# Устанавливаем системные зависимости для Alpine
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    && rm -rf /var/cache/apk/*

# Копируем файлы package.json и package-lock.json для кэширования зависимостей
COPY package*.json ./

# Устанавливаем зависимости Node.js (включая dev, т.к. сборка использует tsc/vite)
RUN npm ci

# Копируем исходный код проекта
COPY . .

# Создаем переменные окружения для продакшн сборки
ENV NODE_ENV=production
ENV GENERATE_SOURCEMAP=false

# Собираем приложение для продакшн
RUN npm run build

# ================================================
# 🌐 STAGE 2: PRODUCTION - Nginx веб-сервер
# ================================================
FROM nginx:1.25-alpine AS production

# Создаем пользователя для безопасности
RUN addgroup -g 1001 -S nodejs \
    && adduser -S frontend -u 1001

# Устанавливаем дополнительные инструменты
RUN apk add --no-cache curl

# Удаляем стандартную конфигурацию Nginx
RUN rm -rf /usr/share/nginx/html/*

# Копируем собранное приложение из builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Создаем кастомную конфигурацию Nginx для React Router
COPY <<EOF /etc/nginx/conf.d/default.conf
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # Сжатие статических файлов
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    # Кэширование статических ресурсов
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files \$uri =404;
    }

    # Обработка React Router (SPA)
    location / {
        try_files \$uri \$uri/ /index.html;
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Referrer-Policy "no-referrer-when-downgrade" always;
    }

    # Прокси для API запросов к бэкенду
    location /api/ {
        proxy_pass http://backend:5000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    # Прокси для WebSocket соединений (транскрипция)
    location /ws/voice {
        proxy_pass http://transcription:8001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Прокси для TTS WebSocket
    location /ws/speak {
        proxy_pass http://tts:8003;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Health check endpoint
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }

    # Логирование
    access_log /var/log/nginx/access.log;
    error_log /var/log/nginx/error.log;
}
EOF

# Создаем директории для логов
RUN mkdir -p /var/log/nginx \
    && chown -R nginx:nginx /var/log/nginx \
    && chown -R nginx:nginx /var/cache/nginx \
    && chown -R nginx:nginx /usr/share/nginx/html

# Устанавливаем правильные права доступа
RUN chmod -R 755 /usr/share/nginx/html

# Экспонируем порт 80
EXPOSE 80

# Добавляем лейблы для метаданных
LABEL maintainer="MoreTech.VTB Team"
LABEL version="1.0.0"
LABEL description="Frontend React приложение для MoreTech.VTB HR платформы"
LABEL architecture="React + TypeScript + Vite + Tailwind CSS"

# Health check для контейнера
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/health || exit 1

# Запускаем Nginx
CMD ["nginx", "-g", "daemon off;"]
