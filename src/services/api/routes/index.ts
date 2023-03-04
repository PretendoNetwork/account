import connections_v1 from '@services/api/routes/v1/connections';
import email_v1 from '@services/api/routes/v1/email';
import forgotPassword_v1 from '@services/api/routes/v1/forgotPassword';
import login_v1 from '@services/api/routes/v1/login';
import register_v1 from '@services/api/routes/v1/register';
import resetPassword_v1 from '@services/api/routes/v1/resetPassword';
import user_v1 from '@services/api/routes/v1/user';

export default {
	V1: {
		CONNECTIONS: connections_v1,
		EMAIL: email_v1,
		FORGOT_PASSWORD: forgotPassword_v1,
		LOGIN: login_v1,
		REGISTER: register_v1,
		RESET_PASSWORD: resetPassword_v1,
		USER: user_v1
	}
};