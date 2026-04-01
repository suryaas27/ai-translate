#!/bin/bash
set -e

PROJECT_ID="ai-initiattives"
REGION="us-central1"
FRONTEND_SERVICE="ai-translate-frontend"

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Usage:
#   ./deploy.sh translation                  ← single backend feature
#   ./deploy.sh transliteration
#   ./deploy.sh backends                     ← all 6 backend features
#   ./deploy.sh frontend [customer]          ← frontend for a customer (default: doqfy)
#   ./deploy.sh all [customer]               ← everything
#
# Legacy compat:
#   ./deploy.sh backend                      ← deploys translation (the main feature)

DEPLOY_TARGET="${1:-all}"
CUSTOMER="${2:-doqfy}"

# All backend feature names
BACKEND_FEATURES=(translation transliteration comparison summary interact extract)

echo "=== AI Translate — Cloud Run Deploy ==="
echo "Project  : $PROJECT_ID"
echo "Region   : $REGION"
echo "Target   : $DEPLOY_TARGET"
echo "Customer : $CUSTOMER"
echo ""

deploy_backend_feature() {
  local FEATURE="$1"
  local SERVICE_NAME="ai-translate-${FEATURE}"
  echo "--- Backend [$FEATURE]: deploying $SERVICE_NAME ---"
  gcloud run deploy "$SERVICE_NAME" \
    --source "$ROOT_DIR/backend" \
    --dockerfile "${FEATURE}/Dockerfile" \
    --project "$PROJECT_ID" \
    --region "$REGION" \
    --allow-unauthenticated \
    --port 8080 \
    --memory 2Gi \
    --cpu 2 \
    --timeout 300
  echo "Backend [$FEATURE] deployed."
  echo "  Service URL: https://${SERVICE_NAME}-6195437887.${REGION}.run.app"
}

deploy_frontend() {
  local CUSTOMER_ID="${1:-doqfy}"
  echo "--- Frontend: deploying $FRONTEND_SERVICE (customer=$CUSTOMER_ID) ---"

  # Per-feature backend URLs (used by Vite at build time via --build-arg)
  local TRANSLATION_URL="https://ai-translate-translation-6195437887.${REGION}.run.app"
  local TRANSLITERATION_URL="https://ai-translate-transliteration-6195437887.${REGION}.run.app"
  local COMPARISON_URL="https://ai-translate-comparison-6195437887.${REGION}.run.app"
  local SUMMARY_URL="https://ai-translate-summary-6195437887.${REGION}.run.app"
  local INTERACT_URL="https://ai-translate-interact-6195437887.${REGION}.run.app"
  local EXTRACT_URL="https://ai-translate-extract-6195437887.${REGION}.run.app"

  gcloud run deploy "$FRONTEND_SERVICE" \
    --source "$ROOT_DIR/frontend" \
    --project "$PROJECT_ID" \
    --region "$REGION" \
    --allow-unauthenticated \
    --port 8080 \
    --memory 512Mi \
    --cpu 1 \
    --build-env-vars "VITE_CUSTOMER=${CUSTOMER_ID},VITE_TRANSLATION_URL=${TRANSLATION_URL},VITE_TRANSLITERATION_URL=${TRANSLITERATION_URL},VITE_COMPARISON_URL=${COMPARISON_URL},VITE_SUMMARY_URL=${SUMMARY_URL},VITE_INTERACT_URL=${INTERACT_URL},VITE_EXTRACT_URL=${EXTRACT_URL}"
  echo "Frontend deployed."
  echo "  Service URL: https://${FRONTEND_SERVICE}-6195437887.${REGION}.run.app"
}

# Legacy backend function (deploys translation only, backward compat)
deploy_backend() {
  deploy_backend_feature "translation"
}

case "$DEPLOY_TARGET" in
  translation|transliteration|comparison|summary|interact|extract)
    deploy_backend_feature "$DEPLOY_TARGET"
    ;;
  backends)
    for f in "${BACKEND_FEATURES[@]}"; do
      deploy_backend_feature "$f"
      echo ""
    done
    ;;
  backend)
    # Legacy: deploy translation only
    deploy_backend
    ;;
  frontend)
    deploy_frontend "$CUSTOMER"
    ;;
  all)
    for f in "${BACKEND_FEATURES[@]}"; do
      deploy_backend_feature "$f"
      echo ""
    done
    deploy_frontend "$CUSTOMER"
    ;;
  *)
    echo "Usage: $0 [translation|transliteration|comparison|summary|interact|extract|backends|backend|frontend|all] [customer_id]"
    exit 1
    ;;
esac

echo ""
echo "=== Done ==="
echo "Frontend : https://${FRONTEND_SERVICE}-6195437887.${REGION}.run.app"
