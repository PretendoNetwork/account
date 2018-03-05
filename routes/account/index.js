const routes = require('express').Router();
const database = require('../../db');
const debug = require('../../debugger');
const route_debugger = new debug('Account Route');

route_debugger.success('Loading \'account\' API routes');
/**
 * [GET]
 * Replacement for: https://id.nintendo.net/account/email-confirmation
 * Description: Verifies a user email via token
 */
routes.get('/email-confirmation', async (request, response) => {
    let _GET = request.query;

    console.log(_GET)

    if (!_GET.token) {
        return response.send('ERROR: Invalid token');
    }

    console.log(2)

    let user = await database.user_collection.findOne({
        'sensitive.email_confirms.token': _GET.token
    });

    console.log(3)

    if (!user) {
        return response.send('ERROR: Invalid token');
    }

    console.log(4)

    user.email.reachable = 'Y';
    user.email.validated = 'Y';

    console.log(5)

    await database.user_collection.update({
        pid: user.pid
    }, {
        $set: {
            email: user.email
        }
    });

    console.log(6)

    user.sensitive.email_confirms.token = null;
    user.sensitive.email_confirms.code = null;

    console.log(7)

    await database.user_collection.update({
        pid: user.pid
    }, {
        $set: {
            sensitive: user.sensitive
        }
    });

    console.log(8)

    response.send('It has been confirmed that you can receive e-mails from Pretenod. The confirmation process is now complete.');

    console.log(9)
});

module.exports = routes;