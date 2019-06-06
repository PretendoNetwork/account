function generateRandomInt(length = 4) {
	return Math.floor(Math.pow(10, length-1) + Math.random() * 9 * Math.pow(10, length-1));
}

module.exports = {
	generateRandomInt
};