FROM python:3.10-slim

WORKDIR /app

# Install system dependencies & Playwright requirements
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright browser dependencies
RUN playwright install chromium
RUN playwright install-deps chromium
# Limit glibc memory fragmentation on Linux
ENV MALLOC_ARENA_MAX=2
ENV PYTHONUNBUFFERED=1

COPY . .

EXPOSE 8000

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1"]
