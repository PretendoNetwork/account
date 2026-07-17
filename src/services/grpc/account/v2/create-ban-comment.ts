import { Status, ServerError } from 'nice-grpc';
import type { CreateBanCommentRequest, CreateBanCommentResponse } from '@pretendonetwork/grpc/account/v2/create_ban_comment_rpc';

export async function createBanComment(_request: CreateBanCommentRequest): Promise<CreateBanCommentResponse> {
	throw new ServerError(
		Status.UNIMPLEMENTED,
		'Stubbed'
	);
}
