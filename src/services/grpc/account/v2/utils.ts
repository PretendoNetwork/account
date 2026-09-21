import { Status, ServerError } from 'nice-grpc';
import { getPNIDByPID } from '@/database';
import type { CallContext } from 'nice-grpc';
import type { PNIDPermissionFlag } from '@/types/common/permission-flags';
import type { HydratedPNIDDocument } from '@/types/mongoose/pnid';

// TODO - The API doesn't have a field for this itself, and this service wasn't made to have a token sent to it because of non-user system use. Should we port the token auth from the API service here anyway instead?
export async function getExecutorPNID(context: CallContext, permission?: PNIDPermissionFlag): Promise<HydratedPNIDDocument> {
	const executorPID = Number(context.metadata.get('X-Executor-PID')?.trim());

	if (!Number.isInteger(executorPID) || executorPID <= 0) {
		throw new ServerError(Status.INVALID_ARGUMENT, 'Missing or invalid X-Executor-PID metadata');
	}

	const pnid = await getPNIDByPID(executorPID);

	if (!pnid) {
		throw new ServerError(Status.NOT_FOUND, 'Executor PNID not found');
	}

	if (permission !== undefined && !pnid.hasPermission(permission)) {
		throw new ServerError(Status.PERMISSION_DENIED, 'Executor PNID lacks the required permission');
	}

	return pnid;
}
