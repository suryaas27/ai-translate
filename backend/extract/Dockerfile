FROM python:3.11-slim-bullseye

WORKDIR /app

ENV PYTHONUNBUFFERED=1

COPY extract/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY extract/ /app/extract/
COPY shared/ /app/shared/

WORKDIR /app/extract

EXPOSE 8080

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080}"]
