#!/usr/bin/env bash
# Exit on error
set -o errexit

pip install --upgrade pip
pip install -r requirements.txt

# If npm is installed in the environment, build the frontend SPA
if command -v npm >/dev/null 2>&1; then
    echo "==> Node/npm detected. Building frontend assets..."
    (cd .. && npm install && npm run build) || echo "Frontend build step skipped."
fi

python manage.py collectstatic --no-input
python manage.py migrate
python manage.py seed_data
