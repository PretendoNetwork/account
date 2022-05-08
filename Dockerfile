FROM node:18-alpine

RUN apk add --no-cache python3 make gcc g++ 
WORKDIR /app

COPY "docker/entrypoint.sh" ./

COPY package*.json ./
RUN npm install bcrypt && npm rebuild bcrypt --build-from-source
RUN npm install

COPY . ./

VOLUME [ "/app/config.json", "/app/certs" ]

CMD ["sh", "entrypoint.sh"]
