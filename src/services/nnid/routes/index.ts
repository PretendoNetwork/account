import admin from '@services/nnid/routes/admin';
import content from '@services/nnid/routes/content';
import devices from '@services/nnid/routes/devices';
import miis from '@services/nnid/routes/miis';
import oauth from '@services/nnid/routes/oauth';
import people from '@services/nnid/routes/people';
import provider from '@services/nnid/routes/provider';
import support from '@services/nnid/routes/support';

export default {
	ADMIN: admin,
	CONTENT: content,
	DEVICES: devices,
	MIIS: miis,
	OAUTH: oauth,
	PEOPLE: people,
	PROVIDER: provider,
	SUPPORT: support,
};