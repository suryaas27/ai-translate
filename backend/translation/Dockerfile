FROM python:3.11-slim-bullseye

WORKDIR /app

ENV PYTHONUNBUFFERED=1

# Install system dependencies (wkhtmltopdf for PDF generation, fonts for Indic scripts)
RUN apt-get update && apt-get install -y \
    build-essential \
    wkhtmltopdf \
    fontconfig \
    xfonts-75dpi \
    xfonts-base \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements (path relative to backend/ build context)
COPY translation/requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the feature app and the shared package
COPY translation/ /app/translation/
COPY shared/ /app/shared/

WORKDIR /app/translation

EXPOSE 8080

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080}"]
