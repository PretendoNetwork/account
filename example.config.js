const fs = require('fs');

module.exports = {
	JWT : {
		SERVICE: {
			PASSPHRASE: 'service_token_rsa_password',
			PRIVATE: fs.readFileSync('./certs/jwt/service/private.pem'),
			PUBLIC: fs.readFileSync('./certs/jwt/service/public.pem'),
		},
		NEX: {
			PASSPHRASE: 'nex_rsa_password',
			PRIVATE: fs.readFileSync('./certs/jwt/nex/private.pem'),
			PUBLIC: fs.readFileSync('./certs/jwt/nex/public.pem'),
		}
	},
	email: {
		address: 'email@provider.com',
		password: 'password'
	},
	mongo: {
		database: 'database_name',
		hostname: 'localhost',
		port: 27017,
		use_authentication: true,
		authentication: {
			username: 'username',
			password: 'password',
			authentication_database: 'admin'
		}

	},
	http: {
		port: 80
	},
	nex_servers: {
		secure_auth: {
			ip: 'ip',
			port: 'port'
		},
		friends: {
			ip: 'ip',
			port: 'port'
		},
		supermariomaker: {
			ip: 'ip',
			port: 'port'
		}
	}
};