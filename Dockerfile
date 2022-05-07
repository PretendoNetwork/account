FROM node:14-alpine

RUN apk add --no-cache python3 make gcc g++ 
WORKDIR /app

COPY "docker/entrypoint.sh" .

COPY package*.json .
RUN npm install

COPY . .

VOLUME [ "/app/config.json" ]

CMD ["sh", "entrypoint.sh"]
