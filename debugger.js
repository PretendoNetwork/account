const ms = require('ms');
require('colors');

class Debugger {
	constructor(title) {
		this.title = title;
		this.previous_time = new Date();
	}

	success(input) {
		const current_time = new Date();
		const time_taken = ms(ms(current_time - this.previous_time));
		let suffix = '';

		if (time_taken > 0) {
			suffix = '-> '.green + (time_taken + 'ms').magenta;
		}

		const message = (this.title + ':').green.bold + ' ' + input.yellow.bold + ' ' + suffix.bold;

		console.log(message);

		this.previous_time = current_time;
	}

	error(input) {
		const current_time = new Date();
		const time_taken = ms(ms(current_time - this.previous_time));
		let suffix = '';

		if (time_taken > 0) {
			suffix = '-> '.green + (time_taken + 'ms').magenta;
		}

		const message = (this.title + ':').red.bold + ' ' + input.yellow.bold + ' ' + suffix.bold;

		console.log(message);

		this.previous_time = current_time;
	}

	log(input) {
		const current_time = new Date();
		const time_taken = ms(ms(current_time - this.previous_time));
		let suffix = '';

		if (time_taken > 0) {
			suffix = '-> '.green + (time_taken + 'ms').magenta;
		}

		const message = (this.title + ':').cyan.bold + ' ' + input.yellow.bold + ' ' + suffix.bold;

		console.log(message);

		this.previous_time = current_time;
	}
}

module.exports = Debugger;