FROM node:lts-alpine

RUN addgroup --system app && adduser --system --ingroup app app

WORKDIR /app

COPY dist/apps/responsia-tax-backend/package*.json ./
RUN npm install --omit=dev

COPY dist/apps/responsia-tax-backend/ .

RUN chown -R app:app /app
USER app

EXPOSE 3000
CMD ["node", "main.js"]
