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
			'import/no-unresolved': ['error', {
				ignore: [
					'mii-js' // mii-js is a weird package that doesn't have a proper module resolution - it's from GitHub
				]
			}]
		}
	}
];
