const {
    copyFileSync,
    cpSync,
    existsSync,
    mkdirSync,
    readFileSync,
    rmSync,
    statSync,
} = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const docsDirectory = path.join(projectRoot, 'docs');
const libraryBuild = path.join(projectRoot, 'dist', 'klee.min.js');
const outputDirectory = path.join(projectRoot, 'site-dist');
const outputLibrary = path.join(outputDirectory, 'js', 'klee.min.js');

const requiredSourceFiles = [
    path.join(docsDirectory, 'index.html'),
    path.join(docsDirectory, 'style.css'),
    libraryBuild,
];

for (const file of requiredSourceFiles) {
    if (!existsSync(file) || !statSync(file).isFile()) {
        throw new Error(`Required site source is missing: ${path.relative(projectRoot, file)}`);
    }
}

rmSync(outputDirectory, { recursive: true, force: true });
cpSync(docsDirectory, outputDirectory, { recursive: true });
mkdirSync(path.dirname(outputLibrary), { recursive: true });
copyFileSync(libraryBuild, outputLibrary);

function validateLocalReference(sourceFile, reference) {
    const trimmedReference = reference.trim();
    if (
        !trimmedReference ||
        trimmedReference.startsWith('#') ||
        trimmedReference.startsWith('//') ||
        /^[a-z][a-z\d+.-]*:/i.test(trimmedReference)
    ) {
        return;
    }

    const referencePath = trimmedReference.split(/[?#]/, 1)[0];
    const targetPath = referencePath.startsWith('/')
        ? path.join(outputDirectory, referencePath.slice(1))
        : path.resolve(path.dirname(sourceFile), referencePath);
    const relativeTarget = path.relative(outputDirectory, targetPath);

    if (
        relativeTarget === '..' ||
        relativeTarget.startsWith(`..${path.sep}`) ||
        path.isAbsolute(relativeTarget)
    ) {
        throw new Error(`Site reference escapes the deployment directory: ${trimmedReference}`);
    }

    if (!existsSync(targetPath) || !statSync(targetPath).isFile()) {
        throw new Error(
            `Missing local site reference in ${path.relative(outputDirectory, sourceFile)}: ${trimmedReference}`,
        );
    }
}

function validateReferences(sourceFile, pattern, referenceGroup) {
    const source = readFileSync(sourceFile, 'utf8');
    for (const match of source.matchAll(pattern)) {
        validateLocalReference(sourceFile, match[referenceGroup]);
    }
    return source;
}

const outputHtmlPath = path.join(outputDirectory, 'index.html');
const outputHtml = validateReferences(
    outputHtmlPath,
    /(?:src|href)\s*=\s*["']([^"']+)["']/gi,
    1,
);
validateReferences(
    path.join(outputDirectory, 'style.css'),
    /url\(\s*(["']?)([^"')]+)\1\s*\)/gi,
    2,
);

const uncommentedHtml = outputHtml.replace(/<!--[\s\S]*?-->/g, '');
if (!uncommentedHtml.includes('src="js/klee.min.js"')) {
    throw new Error('The deployed index.html does not load js/klee.min.js');
}

if (statSync(outputLibrary).size === 0) {
    throw new Error('The deployed JavaScript bundle is empty');
}

console.log(`Built static site in ${path.relative(projectRoot, outputDirectory)}/`);
