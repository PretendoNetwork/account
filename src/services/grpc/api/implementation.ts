import { register } from '@/services/grpc/api/register';
import { login } from '@/services/grpc/api/login';
import { getUserData } from '@/services/grpc/api/get-user-data';
import { updateUserData } from '@/services/grpc/api/update-user-data';
import { forgotPassword } from '@/services/grpc/api/forgot-password';
import { resetPassword } from '@/services/grpc/api/reset-password';
import { setDiscordConnectionData } from '@/services/grpc/api/set-discord-connection-data';
import { setStripeConnectionData } from '@/services/grpc/api/set-stripe-connection-data';

export const apiServiceImplementation = {
	register,
	login,
	getUserData,
	updateUserData,
	forgotPassword,
	resetPassword,
	setDiscordConnectionData,
	setStripeConnectionData
};
