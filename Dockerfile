FROM python:3.12-slim-bookworm

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY scripts ./scripts
COPY assets ./assets
COPY cloudflare/token-gate.js ./cloudflare/token-gate.js
RUN mkdir -p /data \
    && useradd --create-home --uid 10001 draft \
    && chown -R draft:draft /data /app
USER draft
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8080 \
    DRAFT_HOSTED=1 \
    DRAFT_TRUST_PROXY=1 \
    DRAFT_XHS_BROWSER=disabled \
    WECHAT_CONFIG_PATH=/data/credentials.json \
    DRAFT_STATE_DIR=/data
EXPOSE 8080
CMD ["python", "scripts/hosted.py"]
