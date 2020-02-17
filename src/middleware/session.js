// super basic and there's probably a much better way to do this

// this will only be used during the registration process, to track the progress of the user
// express-session uses cookies which the WiiU does not support during the registration process

// temp, in-memory session storage
const sessionStore = {};

function sessionMiddlware(request, response, next) {
	const ip = request.headers['x-forwarded-for'] || request.connection.remoteAddress;
	
	if (!sessionStore[ip]) {
		sessionStore[ip] = {};
	}

	const session = sessionStore[ip];

	request.session = session;

	return next();
}

module.exports = sessionMiddlware;