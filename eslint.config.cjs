const eslint = require('@eslint/js');
const tseslint = require('typescript-eslint');

module.exports = tseslint.config(
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    {
        ignores: [
            'node_modules/**',
            'built/**',
            'dist/**',
            '.bun/**',
            '**/*.config.js',
            'coverage/**',
            '**/*.min.js',
            '**/*.bundle.js',
            'files/**',
            'locales.old/**',
            'scripts/**',
            'gulpfile.js'
        ],
    },
    {
        files: ['packages/*/src/**/*.{ts,tsx}'],
        languageOptions: {
            parserOptions: {
                project: ['./packages/*/tsconfig.json'],
                tsconfigRootDir: __dirname,
            },
        },
        rules: {
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unused-vars': 'off',
            'no-console': 'off',
            'no-case-declarations': 'off',
            'no-useless-escape': 'off',
            'no-control-regex': 'off',
            'no-constant-condition': 'off',
            'no-async-promise-executor': 'off',
            'no-prototype-builtins': 'off',
            '@typescript-eslint/ban-ts-comment': 'off',
            'no-sparse-arrays': 'off',
            'no-useless-catch': 'off',
            'no-empty': 'off',
        },
    }
);
