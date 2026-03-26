#!/bin/bash
set -e

PROJECT_ID="ai-initiattives"
REGION="us-central1"
BACKEND_SERVICE="ai-translate-backend"
FRONTEND_SERVICE="ai-translate-frontend"

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

DEPLOY_TARGET="${1:-all}"  # usage: ./deploy.sh [backend|frontend|all]

echo "=== AI Translate — Cloud Run Deploy ==="
echo "Project : $PROJECT_ID"
echo "Region  : $REGION"
echo "Target  : $DEPLOY_TARGET"
echo ""

deploy_backend() {
  echo "--- Backend: building & deploying ($BACKEND_SERVICE) ---"

  gcloud run deploy "$BACKEND_SERVICE" \
    --source "$ROOT_DIR/backend" \
    --project "$PROJECT_ID" \
    --region "$REGION" \
    --allow-unauthenticated \
    --memory 2Gi \
    --cpu 2 \
    --timeout 300 \
    --concurrency 10 \
    --set-env-vars "^|^GCS_BUCKET_NAME=ops-e-stamp-store\

  echo "Backend deployed."
}

deploy_frontend() {
  echo "--- Frontend: building & deploying ($FRONTEND_SERVICE) ---"
  gcloud run deploy "$FRONTEND_SERVICE" \
    --source "$ROOT_DIR/frontend" \
    --project "$PROJECT_ID" \
    --region "$REGION" \
    --allow-unauthenticated \
    --port 8080 \
    --memory 512Mi \
    --cpu 1
  echo "Frontend deployed."
}

case "$DEPLOY_TARGET" in
  backend)  deploy_backend ;;
  frontend) deploy_frontend ;;
  all)      deploy_backend; echo ""; deploy_frontend ;;
  *)
    echo "Usage: $0 [backend|frontend|all]"
    exit 1
    ;;
esac

echo ""
echo "=== Done ==="
echo "Backend  : https://$BACKEND_SERVICE-6195437887.$REGION.run.app"
echo "Frontend : https://$FRONTEND_SERVICE-6195437887.$REGION.run.app"
