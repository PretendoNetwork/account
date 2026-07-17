import { Status, ServerError } from 'nice-grpc';
import type { GetDeviceRequest, GetDeviceResponse } from '@pretendonetwork/grpc/account/v2/get_device_rpc';

export async function getDevice(_request: GetDeviceRequest): Promise<GetDeviceResponse> {
	throw new ServerError(
		Status.UNIMPLEMENTED,
		'Stubbed'
	);
}
