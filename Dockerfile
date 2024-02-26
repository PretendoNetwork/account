FROM node:20.4.0-alpine3.18

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . ./
RUN npm run build

CMD npm start