# Setup

- [Required software](#required-software)
	- [NodeJS](#nodejs)
	- [MongoDB](#mongodb)
- [Optional features](#optional-features)
	- [Redis (optional)](#redis-optional)
	- [Email (optional)](#email-optional)
	- [Amazon s3 server (optional)](#amazon-s3-server-optional)
	- [hCaptcha (optional)](#hcaptcha-optional)
	- [CDN](#cdn)
- [Configuration](#configuration)


## Required software

- [NodeJS](https://nodejs.org/)
- [MongoDB](https://www.mongodb.com)

### NodeJS

Download and install the latest LTS version of [NodeJS](https://nodejs.org/). If using a Linux based operating system, using [nvm](https://github.com/nvm-sh/nvm) is the recommended method. _Tested on NodeJS version v18.12.1_

### MongoDB

Download and install the latest version of [MongoDB](https://www.mongodb.com)

The server assumes that MongoDB is running as replica set, ensure you have configured this properly

## Optional features

- [Redis](https://redis.io/) file caching
- Email address for sending automatic emails (tested with gmail)
- Amazon s3, or compatible, server for CDN methods
- [hCaptcha](https://hcaptcha.com/) for website API captcha verification

### Redis (optional)

Redis can be used to cache files read from disk. If Redis is not configured, then an in-memory object store is used instead

### Email (optional)

Events such as account creation, email verification, etc, support sending emails to users. To enable email sending, create an email address which is compatible with [Nodemailer](https://nodemailer.com/). Which email service you use does not matter, see the Nodemailer documentation for more details

### Amazon s3 server (optional)

Certain endpoints expect URLs for static CDN assets, such as pre-rendered Mii images. An [Amazon s3](https://aws.amazon.com/s3/) or compatible server, such as [Spaces by DigitalOcean](https://www.digitalocean.com/products/spaces), [Cloudflare R2](https://www.cloudflare.com/products/r2/), or [Backblaze B2](https://www.backblaze.com/b2/docs/), can optionally be used to store and upload these assets. If an s3 server is not configured, CDN contents will be stored on disk and served from this server. See [Configuration](#configuration) for more details

### hCaptcha (optional)

The Pretendo Network website uses this server as an API for querying user information. Certain endpoints are considered more secure than others, such as registration, and can optionally be protected using [hCaptcha](https://hcaptcha.com/). If hCaptcha is not configured, no endpoints on the public facing API will be protected

## Configuration

Configurations are loaded through environment variables. `.env` files are supported. All configuration options will be gone over, both required and optional. There also exists an example `.env` file

| Name                                          | Description                                                                                      | Optional |
|-----------------------------------------------|--------------------------------------------------------------------------------------------------|----------|
| `PN_ACT_CONFIG_HTTP_PORT`                     | The HTTP port the server listens on                                                              | No       |
| `PN_ACT_CONFIG_MONGO_CONNECTION_STRING`       | MongoDB connection string                                                                        | No       |
| `PN_ACT_CONFIG_MONGOOSE_CONNECT_OPTIONS_PATH` | Path to a `.json` file containing Mongoose connection options                                    | Yes      |
| `PN_ACT_CONFIG_REDIS_URL`                     | Redis URL                                                                                        | Yes      |
| `PN_ACT_CONFIG_EMAIL_HOST`                    | SMTP host                                                                                        | Yes      |
| `PN_ACT_CONFIG_EMAIL_PORT`                    | SMTP port                                                                                        | Yes      |
| `PN_ACT_CONFIG_EMAIL_SECURE`                  | Is the email server secure                                                                       | Yes      |
| `PN_ACT_CONFIG_EMAIL_USERNAME`                | Email account username                                                                           | Yes      |
| `PN_ACT_CONFIG_EMAIL_PASSWORD`                | Email account password                                                                           | Yes      |
| `PN_ACT_CONFIG_EMAIL_FROM`                    | Email "from" address                                                                             | Yes      |
| `PN_ACT_CONFIG_S3_ENDPOINT`                   | s3 server endpoint                                                                               | Yes      |
| `PN_ACT_CONFIG_S3_ACCESS_KEY`                 | s3 secret key                                                                                    | Yes      |
| `PN_ACT_CONFIG_S3_ACCESS_SECRET`              | s3 secret                                                                                        | Yes      |
| `PN_ACT_CONFIG_HCAPTCHA_SECRET`               | hCaptcha secret (in the form `0x...`)                                                            | Yes      |
| `PN_ACT_CONFIG_CDN_SUBDOMAIN`                 | Subdomain used to serve CDN contents if s3 is disabled                                           | Yes      |
| `PN_ACT_CONFIG_CDN_DISK_PATH`                 | File system path used to store CDN contents if s3 is disabled                                    | Yes      |
| `PN_ACT_CONFIG_CDN_BASE_URL`                  | URL for serving CDN contents (usually the same as s3 endpoint)                                   | No       |
| `PN_ACT_CONFIG_WEBSITE_BASE`                  | Website URL                                                                                      | Yes      |
| `PN_ACT_CONFIG_AES_KEY`                       | AES-256 key used for encrypting tokens                                                           | No       |
| `PN_ACT_CONFIG_DATASTORE_SIGNATURE_SECRET`    | HMAC secret key (16 bytes in hex format) used to sign uploaded DataStore files                   | No       |
| `PN_ACT_CONFIG_GRPC_MASTER_API_KEY_ACCOUNT`   | Master API key to interact with the account gRPC service                                         | No       |
| `PN_ACT_CONFIG_GRPC_MASTER_API_KEY_API`       | Master API key to interact with the API gRPC service                                             | No       |
| `PN_ACT_CONFIG_GRPC_PORT`                     | gRPC server port                                                                                 | No       |
| `PN_ACT_CONFIG_STRIPE_SECRET_KEY`             | Stripe API key. Used to cancel subscriptions when scrubbing PNIDs                                | Yes      |
| `PN_ACT_CONFIG_SERVER_ENVIRONMENT`            | Server environment. Currently only used by the Wii U Account Settings app. `prod`/`test`/`dev`   | Yes      |