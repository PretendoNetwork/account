# Setup using Docker

## Overview
To use this, you must have Docker installed on your system. Please follow a tutorial elsewhere.

After performing the following steps, you will have the following running containers:
- mongodb (the database)
- account (the account server itself)

## Building the image
Use the following command to build the image:
```bash
$ docker build -t account .
```

## Running Using `docker run`
Create a `.env` file with all of the environment variables set. The list of variables can be found in [SETUP.md](SETUP.md).

Use a command similar to the following:
```bash
$ docker run --name mongodb -d -p 27017:27017 -e MONGODB_INITDB_ROOT_USERNAME=user -e MONGODB_INITDB_ROOT_PASSWORD=pass -v $(pwd)/data:/data/db mongo
$ docker run --name account -d -p 7070:7070 -p 7071:7071 -v $(pwd)/cdn:/app/cdn --env-file .env account
```

## Running Using `docker compose`
This is an example `docker-compose.yaml` file that will set up the containers, configure them, and launch them:

```yaml
services:
  mongodb:
    image: mongo
    container_name: mongodb
    ports:
      - "27017:27017"
    environment:
      MONGODB_INITDB_ROOT_USERNAME: "user"
      MONGODB_INITDB_ROOT_PASSWORD: "pass"
    volumes:
      - "${PWD}/data:/data/db"
    networks:
      - pretendo_web
  account:
    image: account
    container_name: account
    ports:
      - "7070:7070"
      - "7071:7071"
    environment:
      PN_ACT_PREFER_ENV_CONFIG: "true"
      PN_ACT_CONFIG_HTTP_PORT: "7070"
      PN_ACT_CONFIG_MONGO_CONNECTION_STRING: "mongodb://mongodb:27017/pretendo"
      PN_ACT_CONFIG_CDN_BASE_URL: "http://pretendoacct.local"
      PN_ACT_CONFIG_CDN_SUBDOMAIN: "cdn"
      PN_ACT_CONFIG_CDN_DISK_PATH: "./cdn"
      PN_ACT_CONFIG_WEBSITE_BASE: "https://example.com"
      PN_ACT_CONFIG_AES_KEY: "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789"
      PN_ACT_CONFIG_GRPC_MASTER_API_KEY_ACCOUNT: "apikey"
      PN_ACT_CONFIG_GRPC_MASTER_API_KEY_API: "apikey"
      PN_ACT_CONFIG_GRPC_PORT: "7071"
    volumes:
      - "${PWD}/cdn:/app/cdn"
    networks:
      - pretendo_web

networks:
  pretendo_web:
    driver: bridge
    attachable: true
```
