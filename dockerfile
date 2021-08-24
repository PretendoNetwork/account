# syntax=docker/dockerfile:1
FROM node:12-alpine
EXPOSE 7070/tcp
RUN apk add --no-cache npm python3 make g++
WORKDIR /app
COPY . .
RUN mkdir /config
VOLUME /config
WORKDIR /app/src
RUN mv example.config.json /config/config.json
RUN mv example.servers.json /config/servers.json
RUN npm install
WORKDIR /app
RUN echo "cp /config/config.json /app/src/config.json && cp /config/servers.json /app/src/servers.json &&  npm start" > startup.sh
RUN chmod +x startup.sh
ENTRYPOINT "/app/startup.sh"