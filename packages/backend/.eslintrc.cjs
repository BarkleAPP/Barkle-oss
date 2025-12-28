module.exports = {
    root: true,
    env: {
        'node': true,
        'es2022': true,
    },
    parser: '@typescript-eslint/parser',
    parserOptions: {
        'ecmaVersion': 2022,
        'sourceType': 'module',
        project: ['./tsconfig.json'],
        tsconfigRootDir: __dirname,
    },
    extends: [
        '../shared/.eslintrc.cjs',
    ],
    rules: {
        // Backend-specific rules can be added here
    },
};