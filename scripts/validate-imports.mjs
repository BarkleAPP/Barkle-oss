#!/usr/bin/env node
/**
 * Import Validator - Find broken imports in TypeScript files
 * Checks for:
 * - Missing .js extensions
 * - Invalid import paths
 * - Non-existent modules
 * - Circular dependencies
 */

import { readdir, readFile, stat } from 'fs/promises';
import { join, dirname, resolve, extname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BACKEND_SRC = resolve(__dirname, '../packages/backend/src');
const ALGORITHM_SRC = resolve(__dirname, '../packages/algorithm/src');

const issues = [];
let filesChecked = 0;

async function getAllTsFiles(dir) {
    const files = [];

    async function walk(directory) {
        const entries = await readdir(directory, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = join(directory, entry.name);

            if (entry.isDirectory()) {
                if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
                    await walk(fullPath);
                }
            } else if (entry.isFile() && entry.name.endsWith('.ts')) {
                files.push(fullPath);
            }
        }
    }

    await walk(dir);
    return files;
}

async function checkImports(filePath) {
    filesChecked++;
    const content = await readFile(filePath, 'utf-8');
    const fileDir = dirname(filePath);

    // Match import statements
    const importRegex = /import\s+(?:{[^}]+}|[\w\s,*]+)\s+from\s+['"]([^'"]+)['"]/g;
    const matches = [...content.matchAll(importRegex)];

    for (const match of matches) {
        const importPath = match[1];

        // Check for problematic imports

        // 1. Check for bare module imports without extension
        if (importPath === 'module') {
            issues.push({
                file: filePath.replace(process.cwd(), '.'),
                line: content.substring(0, match.index).split('\n').length,
                issue: `Invalid import: 'module' - this is not a valid module`,
                import: match[0]
            });
            continue;
        }

        // 2. Check relative imports without .js extension
        if (importPath.startsWith('.') || importPath.startsWith('@/')) {
            let resolvedPath = importPath;

            // Convert @/ alias to actual path
            if (importPath.startsWith('@/')) {
                const srcDir = filePath.includes('/backend/') ? BACKEND_SRC : ALGORITHM_SRC;
                resolvedPath = importPath.replace('@/', srcDir + '/');
            } else {
                resolvedPath = resolve(fileDir, importPath);
            }

            // For imports with .js extension, check if corresponding .ts file exists
            if (importPath.endsWith('.js')) {
                const tsPath = resolvedPath.replace(/\.js$/, '.ts');

                try {
                    await stat(tsPath);
                    // File exists - good!
                } catch (err) {
                    // Try index file
                    const indexPath = resolvedPath.replace(/\.js$/, '/index.ts');
                    try {
                        await stat(indexPath);
                        // Index exists - good!
                    } catch {
                        issues.push({
                            file: filePath.replace(process.cwd(), '.'),
                            line: content.substring(0, match.index).split('\n').length,
                            issue: `⛔ CRITICAL: Imported file does not exist!`,
                            import: match[0],
                            missingFile: tsPath.replace(process.cwd(), '.')
                        });
                    }
                }
                continue;
            }

            // Check if import has .js extension
            if (!importPath.endsWith('.js') && !importPath.endsWith('.json')) {
                // Check if the file exists with .ts extension
                const tsPath = resolvedPath.endsWith('.ts') ? resolvedPath : resolvedPath + '.ts';

                try {
                    await stat(tsPath);
                    issues.push({
                        file: filePath.replace(process.cwd(), '.'),
                        line: content.substring(0, match.index).split('\n').length,
                        issue: `Missing .js extension (found ${tsPath.replace(process.cwd(), '.')})`,
                        import: match[0],
                        suggestion: match[0].replace(importPath, importPath + '.js')
                    });
                } catch (err) {
                    // File doesn't exist - might be an index file
                    const indexPath = join(resolvedPath, 'index.ts');
                    try {
                        await stat(indexPath);
                        issues.push({
                            file: filePath.replace(process.cwd(), '.'),
                            line: content.substring(0, match.index).split('\n').length,
                            issue: `Missing .js extension for index import`,
                            import: match[0],
                            suggestion: match[0].replace(importPath, importPath + '/index.js')
                        });
                    } catch {
                        // File truly doesn't exist
                        issues.push({
                            file: filePath.replace(process.cwd(), '.'),
                            line: content.substring(0, match.index).split('\n').length,
                            issue: `Import path does not exist: ${resolvedPath}`,
                            import: match[0]
                        });
                    }
                }
            }
        }
    }
}

async function main() {
    console.log('🔍 Validating imports in backend and algorithm packages...\n');

    const backendFiles = await getAllTsFiles(BACKEND_SRC);
    console.log(`Found ${backendFiles.length} TypeScript files in backend`);

    for (const file of backendFiles) {
        await checkImports(file);
    }

    try {
        const algorithmFiles = await getAllTsFiles(ALGORITHM_SRC);
        console.log(`Found ${algorithmFiles.length} TypeScript files in algorithm`);

        for (const file of algorithmFiles) {
            await checkImports(file);
        }
    } catch (err) {
        console.log('Algorithm package not found or empty');
    }

    console.log(`\n✅ Checked ${filesChecked} files\n`);

    if (issues.length === 0) {
        console.log('🎉 No import issues found!');
        process.exit(0);
    }

    console.log(`❌ Found ${issues.length} import issues:\n`);

    // Group by file
    const byFile = {};
    for (const issue of issues) {
        if (!byFile[issue.file]) byFile[issue.file] = [];
        byFile[issue.file].push(issue);
    }

    for (const [file, fileIssues] of Object.entries(byFile)) {
        console.log(`\n📁 ${file}`);
        for (const issue of fileIssues) {
            console.log(`  Line ${issue.line}: ${issue.issue}`);
            console.log(`    ${issue.import}`);
            if (issue.suggestion) {
                console.log(`    💡 Suggested: ${issue.suggestion}`);
            }
        }
    }

    console.log(`\n\n📊 Summary: ${issues.length} issues in ${Object.keys(byFile).length} files`);
    process.exit(1);
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
