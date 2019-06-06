const json2xml = require('json2xml');

module.exports = nintendoClientHeaderCheck;

function nintendoClientHeaderCheck(request, response, next) {
	request.errors = [];
	
	request.checkForErrors = callback => {
		const {errors} = request;
		if (errors.length > 0) {
			response.status(400);
	
			return response.send(json2xml({ errors }));
		}

		return (callback ? callback() : new Promise(resolve => resolve));
	};

	return next();
}