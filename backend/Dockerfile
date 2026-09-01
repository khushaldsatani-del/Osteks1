# Cloud Run builds and runs this directly — no separate config needed
# beyond what's here. Matches how the app already runs locally/on Render:
# main.py reads the PORT env var itself and binds 0.0.0.0 (Cloud Run
# injects PORT=8080 automatically), so the same "python main.py" start
# command works unchanged across all three environments.
FROM python:3.12-slim

WORKDIR /app

# System libraries PyMuPDF/Pillow's wheels occasionally need at runtime on
# a minimal slim image (font/rendering support) — installed once here so
# they don't need to be reinstalled on every deploy the way pip packages do.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libjpeg62-turbo \
    zlib1g \
    && rm -rf /var/lib/apt/lists/*

# Dependencies copied and installed before the rest of the source, so
# Docker's layer cache reuses this (slow) step on every future deploy that
# only changes application code, not requirements.txt.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Cloud Run sets PORT itself (default 8080) and routes traffic to whatever
# port the container actually listens on — this EXPOSE is documentation for
# humans/other tooling, not something Cloud Run reads to decide the port.
EXPOSE 8080

CMD ["python", "main.py"]


