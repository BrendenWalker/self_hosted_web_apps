FROM python:3.13-slim

ARG VERSION=dev
ENV VERSION=${VERSION}
ENV DOCKER_IMAGE_TAG=${VERSION}
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PIP_DISABLE_PIP_VERSION_CHECK=1
ENV PORT=80

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    wget \
  && rm -rf /var/lib/apt/lists/*

COPY pethub/backend/requirements.txt ./
RUN pip install --no-cache-dir --upgrade 'pip>=26.0' \
  && pip install --no-cache-dir -r requirements.txt

COPY pethub/backend/ ./

RUN sed -i 's/\r$//' /app/entrypoint.sh 2>/dev/null || true \
  && chmod +x /app/entrypoint.sh

EXPOSE 80

ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["gunicorn", "-w", "2", "-k", "gthread", "--threads", "4", "-b", "0.0.0.0:80", "app:app"]
