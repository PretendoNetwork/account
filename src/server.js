const express = require('express');
const morgan = require('morgan');
const xmlparser = require('./middleware/xml-parser');
const cache = require('./cache');
const database = require('./database');
const logger = require('../logger');

const app = express();
const port = process.env.PORT || 3000;

async function configure() {
  try {
    await database.connect();
    await cache.connect();
  } catch (err) {
    logger.error(`Error connecting to database or cache: ${err}`);
    process.exit(1);
  }
}

function setupMiddleware() {
  app.use(morgan('dev'));
  app.use(express.json());
  app.use(express.urlencoded({
    extended: true,
  }));
  app.use(xmlparser);
}

function setupRouters() {
  const conntestRouter = require('./services/conntest');
  const nnidRouter = require('./services/nnid');
  const nascRouter = require('./services/nasc');
  const datastoreRouter = require('./services/datastore');
  const apiRouter = require('./services/api');
  const localcdnRouter = require('./services/local-cdn');
  const assetsRouter = require('./services/assets');

  app.use(conntestRouter);
  app.use(nnidRouter);
  app.use(nascRouter);
  app.use(datastoreRouter);
  app.use(apiRouter);
  app.use(localcdnRouter);
  app.use(assetsRouter);
}

function setup404Handler() {
  app.use((_req, res) => {
    res.sendStatus(404);
  });
}

function setupErrorHandler() {
  app.use((err, _req, res) => {
    logger.error(`Unhandled error: ${err}`);
    res.sendStatus(500);
  });
}

async function startServer() {
  await configure();
  setupMiddleware();
  setupRouters();
  setup404Handler();
  setupErrorHandler();

  app.listen(port, () => {
    logger.success(`Server started on port ${port}`);
  });
}

startServer().catch((err) => {
  logger.error(`Failed to start server: ${err}`);
  process.exit(1);
});
