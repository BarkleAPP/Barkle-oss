import { describe, test, expect } from 'vitest';
import { sqlLikeEscape } from '../../src/misc/sql-like-escape.js';

describe('sqlLikeEscape', () => {
    test('Escapes %', () => {
        expect(sqlLikeEscape('a%b')).toBe('a\\%b');
    });

    test('Escapes _', () => {
        expect(sqlLikeEscape('a_b')).toBe('a\\_b');
    });

    test('Escapes \\', () => {
        expect(sqlLikeEscape('a\\b')).toBe('a\\\\b');
    });

    test('Escapes all', () => {
        expect(sqlLikeEscape('a%b_c\\d')).toBe('a\\%b\\_c\\\\d');
    });
});
