import { Status, ServerError } from 'nice-grpc';
import type { UpdateDeviceRequest, UpdateDeviceResponse } from '@pretendonetwork/grpc/account/v2/update_device_rpc';

export async function updateDevice(_request: UpdateDeviceRequest): Promise<UpdateDeviceResponse> {
	throw new ServerError(
		Status.UNIMPLEMENTED,
		'Stubbed'
	);
}
