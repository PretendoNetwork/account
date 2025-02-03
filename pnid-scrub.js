const { confirm, input } = require('@inquirer/prompts');
const { connect } = require('./dist/database');
const { PNID } = require('./dist/models/pnid');

async function bootstrap() {
	await connect();

	const pnidName = await input({ message: 'What PNID do you want to delete?' });
	const pnid = await PNID.findOne({ username: pnidName.trim() });
	if (!pnid) {
		console.log('Could not find PNID');
		process.exit(1);
	}

	console.log('Before:', pnid);

	if (pnid.deleted) {
		console.log('PNID is already marked as deleted');
		process.exit(1);
	}

	const confirmed = await confirm({ message: 'Do you want to delete this PNID', default: false });
	if (!confirmed) {
		console.log('Aborted');
		process.exit(1);
	}

	await pnid.scrub();
	await pnid.save();

	console.log('After:', pnid);
	if (pnid.deleted) {
		console.log('SUCCESSFULLY DELETED');
	} else {
		console.log('COULD NOT DELETE');
	}

	process.exit(0);
}

bootstrap();
