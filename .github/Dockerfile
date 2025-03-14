FROM node:22

# Установите зависимости для electron-builder
RUN apt-get update && apt-get install -y \
    libfuse2 \
    libarchive-tools \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Установите electron-builder глобально (опционально)
RUN npm install -g electron-builder