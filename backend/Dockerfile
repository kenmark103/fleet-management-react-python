FROM python:3.13

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y build-essential libpq-dev && rm -rf /var/lib/apt/lists/*

# Copy requirements first (caching optimization)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

# Remove --reload for production, keep for dev
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]