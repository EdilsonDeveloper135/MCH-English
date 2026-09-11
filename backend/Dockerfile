FROM python:3.12-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends espeak-ng \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN useradd -m -u 1000 appuser \
    && mkdir -p /app/audio_cache \
    && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

# FORWARDED_ALLOW_IPS must name the reverse proxy when one is in front, otherwise
# uvicorn ignores X-Forwarded-For and every request looks like it comes from the proxy
# -- which turns the per-IP rate limits into a single shared bucket for all users.
ENV FORWARDED_ALLOW_IPS=127.0.0.1
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips \"$FORWARDED_ALLOW_IPS\""]
