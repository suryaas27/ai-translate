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
    --set-env-vars "^|^GCS_BUCKET_NAME=ops-e-stamp-store|GCS_SIGNING_SERVICE_ACCOUNT_EMAIL=ocr-reader-sa@ai-initiattives.iam.gserviceaccount.com|GCP_PROJECT_ID=ai-initiattives|GCP_LOCATION=us|GCP_PROCESSOR_ID=f6019ba080b3e267|TRANSLATION_FLOW=server|AWS_ACCESS_KEY_ID=AKIAZB42IRWXXE5QJ36B|AWS_SECRET_ACCESS_KEY=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|AWS_DEFAULT_REGION=ap-south-1|BEDROCK_MODEL=global.anthropic.claude-haiku-4-5-20251001-v1:0|VERTEX_LOCATION=asia-south1|VERTEX_MODEL=gemini-2.5-flash|GEMINI_API_KEY=AIzaSyA-bdYyjIeiaxNTu8G8W16wmeNZlBFPKXk|ANTHROPIC_MODEL=claude-haiku-4-5-20251001"

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
