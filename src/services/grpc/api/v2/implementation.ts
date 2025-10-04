import { register } from '@/services/grpc/api/v2/register';
import { login } from '@/services/grpc/api/v2/login';
import { getUserData } from '@/services/grpc/api/v2/get-user-data';
import { updateUserData } from '@/services/grpc/api/v2/update-user-data';
import { forgotPassword } from '@/services/grpc/api/v2/forgot-password';
import { resetPassword } from '@/services/grpc/api/v2/reset-password';
import { setDiscordConnectionData } from '@/services/grpc/api/v2/set-discord-connection-data';
import { setStripeConnectionData } from '@/services/grpc/api/v2/set-stripe-connection-data';
import { deleteAccount } from '@/services/grpc/api/v2/delete-account';

export const apiServiceImplementationV2 = {
	register,
	login,
	getUserData,
	updateUserData,
	forgotPassword,
	resetPassword,
	setDiscordConnectionData,
	setStripeConnectionData,
	deleteAccount
};
