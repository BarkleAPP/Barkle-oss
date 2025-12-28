import tseslint from 'typescript-eslint';

export default tseslint.config(
    {
        ignores: [
            '**/node_modules/**',
            '**/built/**',
            '**/dist/**',
            '**/*.config.js',
            'migration/**',
            'assets/**',
            'test/**',
            '**/*.test.ts',
            '**/*.spec.ts',
        ],
    },
    ...tseslint.configs.recommended,
    {
        languageOptions: {
            parserOptions: {
                project: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
        rules: {
            // Disable overly strict rules
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unused-vars': ['warn', {
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_',
            }],
            '@typescript-eslint/no-non-null-assertion': 'off',
            '@typescript-eslint/ban-ts-comment': 'off',

            // Prevent common errors
            'no-restricted-globals': [
                'error',
                {
                    name: '__dirname',
                    message: 'Not in ESModule. Use `import.meta.url` instead.'
                },
                {
                    name: '__filename',
                    message: 'Not in ESModule. Use `import.meta.url` instead.'
                }
            ],

            // Code quality
            'no-console': ['warn', { allow: ['warn', 'error'] }],
            'prefer-const': 'warn',
            'no-var': 'error',
        },
    },
);
