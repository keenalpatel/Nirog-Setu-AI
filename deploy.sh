#!/bin/bash
# Deploy Nirog Setu ADK Agents to Cloud Run
# Usage: ./deploy.sh

set -e

PROJECT_ID="${GCP_PROJECT_ID:-project-3d39fa0c-2d6a-41aa-948}"
REGION="${GCP_LOCATION:-us-central1}"
SERVICE_NAME="nirog-setu-adk-agents"
IMAGE="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

echo "🏥 Deploying Nirog Setu ADK Agents to Cloud Run..."
echo "   Project: ${PROJECT_ID}"
echo "   Region: ${REGION}"
echo "   Service: ${SERVICE_NAME}"

# Build Docker image
echo "📦 Building Docker image..."
cd adk-agents
docker build -t ${IMAGE} .

# Push to GCR
echo "⬆️  Pushing to Container Registry..."
docker push ${IMAGE}

# Deploy to Cloud Run
echo "🚀 Deploying to Cloud Run..."
gcloud run deploy ${SERVICE_NAME} \
  --image ${IMAGE} \
  --region ${REGION} \
  --platform managed \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 2 \
  --timeout 300 \
  --set-env-vars "GCP_PROJECT_ID=${PROJECT_ID},GCP_LOCATION=${REGION}" \
  --set-env-vars "WHATSAPP_PHONE_NUMBER_ID=${WHATSAPP_PHONE_NUMBER_ID}" \
  --set-env-vars "WHATSAPP_API_VERSION=v25.0"

# Get the service URL
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} --region ${REGION} --format='value(status.url)')
echo ""
echo "✅ Deployment complete!"
echo "   Service URL: ${SERVICE_URL}"
echo "   Health check: ${SERVICE_URL}/health"
echo "   Chat endpoint: ${SERVICE_URL}/chat"
echo ""
echo "📝 Next steps:"
echo "   1. Set WHATSAPP_TOKEN as a secret: gcloud run services update ${SERVICE_NAME} --set-secrets=WHATSAPP_TOKEN=whatsapp-token:latest"
echo "   2. Update your Next.js .env.local with: ADK_SERVICE_URL=${SERVICE_URL}"
echo "   3. Update WhatsApp webhook URL to: ${SERVICE_URL}/webhook/whatsapp"
