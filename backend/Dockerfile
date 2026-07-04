FROM python:3.11-slim

WORKDIR /app

ENV PIP_DEFAULT_TIMEOUT=120 \
    PIP_RETRIES=10 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY requirements-core.txt requirements-cognee.txt requirements.txt ./
RUN pip install --upgrade pip setuptools wheel && \
    pip install --no-cache-dir --default-timeout=120 --retries 10 -r requirements-core.txt && \
    pip install --no-cache-dir --default-timeout=120 --retries 10 -r requirements-cognee.txt

COPY app ./app

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
