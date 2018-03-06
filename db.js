const mongoist = require('mongoist');
const config = require('./config.json');
const user_database_collection_name = 'users';
const database = config.mongo.database;
const hostname = config.mongo.hostname;
const port     = config.mongo.port;
const auth     = config.mongo.authentication;

let connection_string = '';

if (config.mongo.use_authentication) {
	connection_string = `mongodb://${auth.username}:${auth.password}@${hostname}:${port}/${database}?authSource=${auth.authentication_database}`;
} else {
	connection_string = `mongodb://${hostname}:${port}/${database}`;
}

const user_database = mongoist(connection_string);
const user_collection = user_database.collection(user_database_collection_name);

module.exports = {
	user_database: user_database,
	user_collection: user_collection
};
