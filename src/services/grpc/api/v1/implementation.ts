import { register } from '@/services/grpc/api/v1/register';
import { login } from '@/services/grpc/api/v1/login';
import { getUserData } from '@/services/grpc/api/v1/get-user-data';
import { updateUserData } from '@/services/grpc/api/v1/update-user-data';
import { forgotPassword } from '@/services/grpc/api/v1/forgot-password';
import { resetPassword } from '@/services/grpc/api/v1/reset-password';
import { setDiscordConnectionData } from '@/services/grpc/api/v1/set-discord-connection-data';
import { setStripeConnectionData } from '@/services/grpc/api/v1/set-stripe-connection-data';

export const apiServiceImplementationV1 = {
	register,
	login,
	getUserData,
	updateUserData,
	forgotPassword,
	resetPassword,
	setDiscordConnectionData,
	setStripeConnectionData
};
