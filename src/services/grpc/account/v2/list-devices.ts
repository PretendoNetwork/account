import { Status, ServerError } from 'nice-grpc';
import type { ListDevicesRequest, ListDevicesResponse } from '@pretendonetwork/grpc/account/v2/list_devices_rpc';

export async function listDevices(_request: ListDevicesRequest): Promise<ListDevicesResponse> {
	throw new ServerError(
		Status.UNIMPLEMENTED,
		'Stubbed'
	);
}
