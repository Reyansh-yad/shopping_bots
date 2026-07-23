FROM python:3.14-slim

# Install uv for fast dependency installation
RUN pip install uv --no-cache-dir

WORKDIR /app

# Copy dependency manifest first (layer cache)
COPY pyproject.toml uv.lock ./

# Install dependencies (no dev extras, no editable install)
RUN uv pip install --system --no-cache -r pyproject.toml 2>/dev/null || \
    uv pip install --system --no-cache $(python -c "import tomllib; d=tomllib.load(open('pyproject.toml','rb')); print(' '.join(d['project']['dependencies']))")

# Copy source
COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
