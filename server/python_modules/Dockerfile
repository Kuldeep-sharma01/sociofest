FROM python:3.10-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PIP_NO_CACHE_DIR=1
ENV PIP_DISABLE_PIP_VERSION_CHECK=1

# System deps + cleanup
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl wget git build-essential libglib2.0-0 libsm6 libxext6 libxrender-dev libgomp1 \
    ffmpeg libsndfile1 && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 5001

USER 1000:1000

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:5001/health || exit 1

CMD ["python", "app.py"]
