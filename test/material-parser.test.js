const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const moduleCache = new Map();

function resolveTypeScriptModule(parentFile, request) {
    const unresolvedPath = path.resolve(path.dirname(parentFile), request);
    const candidates = [unresolvedPath, `${unresolvedPath}.ts`, path.join(unresolvedPath, "index.ts")];
    return candidates.find(candidate => fs.existsSync(candidate));
}

function loadTypeScriptModule(filePath) {
    const absolutePath = path.resolve(filePath);
    if (moduleCache.has(absolutePath)) return moduleCache.get(absolutePath).exports;

    const source = fs.readFileSync(absolutePath, "utf8");
    const output = ts.transpileModule(source, {
        compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES2020,
        },
        fileName: absolutePath,
    }).outputText;

    const loadedModule = { exports: {} };
    moduleCache.set(absolutePath, loadedModule);

    const localRequire = (request) => {
        if (!request.startsWith(".")) return require(request);
        const resolvedPath = resolveTypeScriptModule(absolutePath, request);
        if (!resolvedPath) throw new Error(`Unable to resolve ${request} from ${absolutePath}`);
        return loadTypeScriptModule(resolvedPath);
    };

    const evaluate = new Function("module", "exports", "require", output);
    evaluate(loadedModule, loadedModule.exports, localRequire);
    return loadedModule.exports;
}

const { readUnrealObjectBlock } = loadTypeScriptModule(
    path.join(projectRoot, "src/parser/unreal-object-block.ts")
);
const { resolveMaterialNodeMetadata } = loadTypeScriptModule(
    path.join(projectRoot, "src/parser/material-node-metadata.ts")
);

const fixture = fs.readFileSync(
    path.join(__dirname, "fixtures/material-function-node.txt"),
    "utf8"
);
const fixtureLines = fixture.replace(/\r/g, "").split("\n").map(line => line.trim());
const objectBlock = readUnrealObjectBlock(fixtureLines, 0);

assert.equal(objectBlock.maximumDepth, 2);
assert.equal(objectBlock.endLineIndex, fixtureLines.length - 2);
assert.equal(objectBlock.lines[0].startsWith("Begin Object"), true);
assert.equal(objectBlock.lines.at(-1), "End Object");

const functionMetadata = resolveMaterialNodeMetadata(
    objectBlock.lines,
    "/Script/UnrealEd.MaterialGraphNode"
);
assert.deepEqual(functionMetadata, {
    title: "GetUserInterfaceUV",
    expressionClass: "/Script/Engine.MaterialExpressionMaterialFunctionCall",
    materialFunction: {
        assetName: "GetUserInterfaceUV",
        objectPath: "/Engine/Functions/UserInterface/GetUserInterfaceUV.GetUserInterfaceUV",
    },
});

const packageNameMetadata = resolveMaterialNodeMetadata([
    "Begin Object Class=/Script/UnrealEd.MaterialGraphNode Name=MaterialGraphNode_0",
    "Begin Object Class=/Script/Engine.MaterialExpressionMaterialFunctionCall Name=MaterialExpressionMaterialFunctionCall_0",
    "MaterialFunction=\"/Script/Engine.MaterialFunction'/Game/Functions/MF_Border.MF_Border_Instance'\"",
    "End Object",
    "End Object",
], "/Script/UnrealEd.MaterialGraphNode");
assert.equal(packageNameMetadata.materialFunction.assetName, "MF_Border");

const legacyQuotedPathMetadata = resolveMaterialNodeMetadata([
    "Begin Object Class=/Script/UnrealEd.MaterialGraphNode Name=MaterialGraphNode_0",
    "Begin Object Class=/Script/Engine.MaterialExpressionMaterialFunctionCall Name=MaterialExpressionMaterialFunctionCall_0",
    "MaterialFunction=MaterialFunction'\"/Engine/Functions/Engine_MaterialFunctions02/Utility/ObjectPivotPoint.ObjectPivotPoint\"'",
    "End Object",
    "End Object",
], "/Script/UnrealEd.MaterialGraphNode");
assert.deepEqual(legacyQuotedPathMetadata.materialFunction, {
    assetName: "ObjectPivotPoint",
    objectPath: "/Engine/Functions/Engine_MaterialFunctions02/Utility/ObjectPivotPoint.ObjectPivotPoint",
});

const parameterMetadata = resolveMaterialNodeMetadata([
    "Begin Object Class=/Script/UnrealEd.MaterialGraphNode Name=MaterialGraphNode_0",
    "Begin Object Class=/Script/Engine.MaterialExpressionScalarParameter Name=MaterialExpressionScalarParameter_0",
    "ParameterName=\"Border Width\"",
    "End Object",
    "End Object",
], "/Script/UnrealEd.MaterialGraphNode");
assert.equal(parameterMetadata.title, "Border Width");

const descriptionMetadata = resolveMaterialNodeMetadata([
    "Begin Object Class=/Script/UnrealEd.MaterialGraphNode_Custom Name=MaterialGraphNode_Custom_0",
    "Begin Object Class=/Script/Engine.MaterialExpressionCustom Name=MaterialExpressionCustom_0",
    "Description=\"Nine-slice remap\"",
    "End Object",
    "End Object",
], "/Script/UnrealEd.MaterialGraphNode_Custom");
assert.equal(descriptionMetadata.title, "Nine-slice remap");

const genericDescriptionMetadata = resolveMaterialNodeMetadata([
    "Begin Object Class=/Script/UnrealEd.MaterialGraphNode Name=MaterialGraphNode_0",
    "Begin Object Class=/Script/Engine.MaterialExpressionMultiply Name=MaterialExpressionMultiply_0",
    "Desc=\"Edge falloff\"",
    "End Object",
    "End Object",
], "/Script/UnrealEd.MaterialGraphNode");
assert.equal(genericDescriptionMetadata.title, "Multiply");

const knownMetadata = resolveMaterialNodeMetadata([
    "Begin Object Class=/Script/UnrealEd.MaterialGraphNode Name=MaterialGraphNode_0",
    "MaterialExpression=\"/Script/Engine.MaterialExpressionMultiply'MaterialExpressionMultiply_0'\"",
    "End Object",
], "/Script/UnrealEd.MaterialGraphNode");
assert.equal(knownMetadata.title, "Multiply");

const fallbackMetadata = resolveMaterialNodeMetadata([
    "Begin Object Class=/Script/UnrealEd.MaterialGraphNode Name=MaterialGraphNode_0",
    "MaterialExpression=\"/Script/Engine.MaterialExpressionProceduralNoiseBlend'MaterialExpressionProceduralNoiseBlend_0'\"",
    "End Object",
], "/Script/UnrealEd.MaterialGraphNode");
assert.equal(fallbackMetadata.title, "Procedural Noise Blend");

const rootMetadata = resolveMaterialNodeMetadata([
    "Begin Object Class=/Script/UnrealEd.MaterialGraphNode_Root Name=MaterialGraphNode_Root_0",
    "Material=\"/Script/UnrealEd.PreviewMaterial'/Engine/Transient.M_UI_9-Slice'\"",
    "End Object",
], "/Script/UnrealEd.MaterialGraphNode_Root");
assert.equal(rootMetadata.title, "M_UI_9-Slice");

assert.throws(
    () => readUnrealObjectBlock(["Begin Object", "Begin Object", "End Object"], 0),
    /never closed/
);

console.log("Material graph parser tests passed.");
