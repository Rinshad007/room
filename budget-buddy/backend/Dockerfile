FROM python:3.11-slim-bookworm

WORKDIR /app

# Force cache bust to ensure OpenSSL patch always runs
ARG CACHEBUST=1

# Install system dependencies + fix OpenSSL 3.x TLS compatibility with MongoDB Atlas
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && update-ca-certificates \
    && grep -q 'UnsafeLegacyRenegotiation' /etc/ssl/openssl.cnf \
    || echo -e '\n[openssl_init]\nssl_conf = ssl_sect\n\n[ssl_sect]\nsystem_default = system_default_sect\n\n[system_default_sect]\nOptions = UnsafeLegacyRenegotiation' >> /etc/ssl/openssl.cnf

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
