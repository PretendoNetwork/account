import mongoose from 'mongoose';

export const domainServices = ['api', 'assets', 'cbvc', 'conntest', 'datastore', 'nasc', 'nnas', 'local_cdn'] as const;
export type DomainService = typeof domainServices[number];

export const optionalDomainServices: DomainService[] = ['local_cdn'];

export interface Config {
	http: {
		port: number;
	};
	mongoose: {
		connection_string: string;
		options: mongoose.ConnectOptions;
	};
	redis: {
		client: {
			url: string;
		}
	};
	email: {
		ses: {
			region: string;
			key: string;
			secret: string;
		};
		from: string;
	};
	s3: {
		endpoint: string;
		key: string;
		secret: string;
	};
	hcaptcha: {
		secret: string;
	};
	cdn: {
		/** 
		 * @deprecated Use `domains.cdn` instead
		 */
		subdomain?: string;
		disk_path: string;
		base_url: string;
	};
	website_base: string;
	aes_key: string;
	grpc: {
		master_api_keys: {
			account: string;
			api: string;
		};
		port: number;
	};
	stripe?: {
		secret_key: string;
	};
	server_environment: string;
	datastore: {
		signature_secret: string;
	};
	domains: Record<DomainService, string[]>;
}
