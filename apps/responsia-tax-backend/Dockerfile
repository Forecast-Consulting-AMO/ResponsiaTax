FROM node:lts-alpine

WORKDIR /app

COPY dist/apps/responsia-tax-backend/package*.json ./
RUN npm install --omit=dev && npm install pg openai @anthropic-ai/sdk @azure/ai-form-recognizer

COPY dist/apps/responsia-tax-backend/ .

# Use Azure persistent /home mount for uploaded files
ENV UPLOAD_DIR=/home/uploads

EXPOSE 3000
CMD ["node", "main.js"]
