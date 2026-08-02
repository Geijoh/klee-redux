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
const { inspectUnrealGraph } = loadTypeScriptModule(
    path.join(projectRoot, "src/parser/graph-inspector.ts")
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

const rootGraph = [
    'Begin Object Class=/Script/UnrealEd.MaterialGraphNode_Root Name="MaterialGraphNode_Root_0"',
    'Material="/Script/UnrealEd.PreviewMaterial\'/Engine/Transient.M_Test\'"',
    'CustomProperties Pin (PinId=1,PinName="Base Color",PinType.PinCategory="materialinput",)',
    'CustomProperties Pin (PinId=2,PinName="Final Color",PinType.PinCategory="materialinput",)',
    'CustomProperties Pin (PinId=3,PinName="Opacity",PinType.PinCategory="materialinput",)',
    'CustomProperties Pin (PinId=4,PinName="Opacity Mask",PinType.PinCategory="materialinput",)',
    'CustomProperties Pin (PinId=5,PinName="Material Attributes",PinType.PinCategory="materialinput",)',
    'End Object',
].join('\n');
const materialFragment = [
    'Begin Object Class=/Script/UnrealEd.MaterialGraphNode Name="MaterialGraphNode_0"',
    'MaterialExpression="/Script/Engine.MaterialExpressionMultiply\'MaterialExpressionMultiply_0\'"',
    'End Object',
].join('\n');
const materialFunction = [
    'Begin Object Class=/Script/UnrealEd.MaterialGraphNode Name="MaterialGraphNode_1"',
    'Begin Object Class=/Script/Engine.MaterialExpressionFunctionOutput Name="MaterialExpressionFunctionOutput_0"',
    'End Object',
    'End Object',
].join('\n');
const blueprintGraph = [
    'Begin Object Class=/Script/BlueprintGraph.K2Node_CallFunction Name="K2Node_CallFunction_0"',
    'End Object',
].join('\n');

const unfilteredInspection = inspectUnrealGraph(rootGraph);
assert.equal(unfilteredInspection.kind, "material");
assert.equal(unfilteredInspection.rootNodeName, "MaterialGraphNode_Root_0");
assert.equal(unfilteredInspection.material.rootInputPolicy.mode, "unfiltered");
assert.equal(unfilteredInspection.preview.pixelRenderingAvailable, false);

const tableInspection = inspectUnrealGraph(rootGraph, {
    domain: "MD_UI",
    blendMode: "BLEND_Translucent",
    unrealVersion: "5.7",
});
assert.deepEqual(tableInspection.material.rootInputPolicy.activeInputs, ["Final Color", "Opacity"]);
assert.equal(tableInspection.material.rootInputPolicy.ruleset, "ue5-common-v1");

const explicitInspection = inspectUnrealGraph(rootGraph, {
    material: { rootInputs: ["Opacity Mask", "Not Serialized"] },
});
assert.deepEqual(explicitInspection.material.rootInputPolicy.activeInputs, ["Opacity Mask"]);
assert.equal(explicitInspection.diagnostics.some(diagnostic => diagnostic.code === "root-input-not-serialized"), true);

const attributesInspection = inspectUnrealGraph(rootGraph, { useMaterialAttributes: true });
assert.deepEqual(attributesInspection.material.rootInputPolicy.activeInputs, ["Material Attributes"]);

const missingAttributesInspection = inspectUnrealGraph(
    rootGraph.replace(/^.*PinName="Material Attributes".*\n?/m, ""),
    { useMaterialAttributes: true }
);
assert.equal(missingAttributesInspection.material.rootInputPolicy.mode, "unfiltered");
assert.equal(missingAttributesInspection.diagnostics.some(diagnostic =>
    diagnostic.code === "root-input-policy-no-match"), true);

const unmatchedExplicitInspection = inspectUnrealGraph(rootGraph, {
    rootInputs: ["Not Serialized"],
});
assert.equal(unmatchedExplicitInspection.material.rootInputPolicy.mode, "unfiltered");

const unmatchedUiInspection = inspectUnrealGraph(
    rootGraph
        .replace(/^.*PinName="Final Color".*\n?/m, "")
        .replace(/^.*PinName="Opacity".*\n?/m, "")
        .replace(/^.*PinName="Opacity Mask".*\n?/m, ""),
    { domain: "UI", blendMode: "Translucent", unrealVersion: "5.7" }
);
assert.equal(unmatchedUiInspection.material.rootInputPolicy.mode, "unfiltered");

const unsupportedVersionInspection = inspectUnrealGraph(rootGraph, {
    domain: "UI",
    blendMode: "Translucent",
    unrealVersion: "4.27",
});
assert.equal(unsupportedVersionInspection.material.rootInputPolicy.mode, "unfiltered");

const serializedSettingsGraph = rootGraph.replace(
    'Material="/Script/UnrealEd.PreviewMaterial\'/Engine/Transient.M_Test\'"',
    [
        'Material="/Script/UnrealEd.PreviewMaterial\'/Engine/Transient.M_Test\'"',
        'MaterialDomain=MD_UI',
        'BlendMode=BLEND_Masked',
        'ShadingModel=MSM_Unlit',
        'bUseMaterialAttributes=False',
        'EngineVersion=5.7',
    ].join('\n')
);
const serializedInspection = inspectUnrealGraph(serializedSettingsGraph, {
    material: { domain: "Surface", blendMode: "Translucent" },
});
assert.equal(serializedInspection.material.domain, "MD_UI");
assert.equal(serializedInspection.material.blendMode, "BLEND_Masked");
assert.equal(serializedInspection.material.provenance.domain, "serialized");
assert.equal(serializedInspection.material.provenance.unrealVersion, "serialized");
assert.deepEqual(serializedInspection.material.rootInputPolicy.activeInputs, ["Final Color", "Opacity Mask"]);
assert.equal(serializedInspection.diagnostics.filter(diagnostic => diagnostic.code === "material-setting-conflict").length, 2);

assert.equal(inspectUnrealGraph(materialFragment).kind, "material-fragment");
assert.equal(inspectUnrealGraph([
    'Begin Object Class=/Script/MyMaterialPlugin.MaterialGraphNode_Special Name="MaterialGraphNode_Special_0"',
    'End Object',
].join('\n')).kind, "material-fragment");
assert.equal(inspectUnrealGraph(materialFunction).kind, "material-function");
assert.equal(inspectUnrealGraph(blueprintGraph).kind, "blueprint");
assert.equal(inspectUnrealGraph(`${blueprintGraph}\n${materialFragment}`).kind, "mixed");
assert.equal(inspectUnrealGraph("not Unreal clipboard text").kind, "unknown");

assert.throws(
    () => readUnrealObjectBlock(["Begin Object", "Begin Object", "End Object"], 0),
    /never closed/
);

console.log("Material graph parser tests passed.");
