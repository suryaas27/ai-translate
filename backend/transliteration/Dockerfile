FROM python:3.11-slim-bullseye

WORKDIR /app

ENV PYTHONUNBUFFERED=1

COPY transliteration/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY transliteration/ /app/transliteration/
COPY shared/ /app/shared/

WORKDIR /app/transliteration

EXPOSE 8080

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080}"]
