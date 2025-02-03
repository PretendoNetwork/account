import eslintConfig from '@pretendonetwork/eslint-config';
import globals from 'globals';

export default [
	...eslintConfig,
	{
		languageOptions: {
			globals: {
				...globals.node
			}
		}
	},
	{
		rules: {
			// * Because mii-js is imported via GitHub, it will not be resolved by eslint
			// TODO: Remove this rule when mii-js is published to npm
			'import/no-unresolved': ['error', { ignore: ['mii-js'] }]
		}
	}
];
