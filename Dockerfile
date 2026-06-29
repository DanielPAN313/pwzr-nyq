FROM node:24-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ENV PORT=4174
EXPOSE 4174

CMD ["npm", "run", "mirror"]
