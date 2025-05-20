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
	}
];
