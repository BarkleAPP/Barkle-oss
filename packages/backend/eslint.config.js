import tseslint from 'typescript-eslint';
import tsParser from '@typescript-eslint/parser';

export default [
	...tseslint.configs.recommended,
	{
		files: ['**/*.ts'],
		languageOptions: {
			parser: tsParser,
			parserOptions: {
				sourceType: 'module',
				project: './tsconfig.json',
			},
		},
		rules: {
			// Security Rules to prevent SQL injection and other vulnerabilities
			'no-template-curly-in-string': 'error', // Ban template strings in queries

			// Custom security rules for database operations
			'no-restricted-syntax': [
				'error',
				{
					selector: 'CallExpression[callee.property.name="query"][arguments.0.type="TemplateLiteral"]',
					message: 'Security: Do not use .query() with template literals. Use parameterized queries or TypeORM methods instead.',
				},
				{
					selector: 'CallExpression[callee.property.name="query"][arguments.0.type="BinaryExpression"][arguments.0.operator="+"]',
					message: 'Security: Do not use .query() with string concatenation. Use parameterized queries or TypeORM methods instead.',
				},
				{
					selector: 'CallExpression[callee.property.name="query"] > .arguments:first-child[type="TemplateLiteral"] :has(Identifier[name=/ps\\./])',
					message: 'Security: Do not interpolate user input (ps.*) into SQL queries. Use parameterized queries instead.',
				},
				{
					selector: 'CallExpression[callee.property.name="query"] > .arguments:first-child[type="TemplateLiteral"] :has(Identifier[name=/user\\./])',
					message: 'Security: Do not interpolate user input (user.*) into SQL queries. Use parameterized queries instead.',
				},
				{
					selector: 'CallExpression[callee.property.name="query"] > .arguments:first-child[type="TemplateLiteral"] TemplateElement[value=/SELECT|INSERT|UPDATE|DELETE|DROP/i]',
					message: 'Security: Raw SQL detected. Use TypeORM repository methods (findOneBy, save, update) instead.',
				},
			],

			// TypeScript best practices
			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/explicit-function-return-type': 'off',
			'@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
			'@typescript-eslint/consistent-type-imports': ['warn', { prefer: 'type-imports', disallowTypeAnnotations: false }],

			// Code quality
			'no-console': ['warn', { allow: ['warn', 'error'] }],
			'no-debugger': 'error',
			'no-alert': 'error',
			'no-eval': 'error',
			'no-implied-eval': 'error',
			'no-new-func': 'error',
			'no-script-url': 'error',
		},
	},
	{
		files: ['**/*.test.ts'],
		rules: {
			'no-restricted-syntax': 'off', // Allow .query() in tests
			'no-template-curly-in-string': 'off',
		},
	},
];
