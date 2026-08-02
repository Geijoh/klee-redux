import {
    KleeAuthoredGraphHints,
    KleeAuthoredMaterialHints,
    KleeDiagnostic,
    KleeGraphInspection,
    KleeGraphKind,
    KleeRootInputPolicy,
} from "../data/graph-inspection";
import { readUnrealObjectBlock } from "./unreal-object-block";

const MATERIAL_NODE_PREFIX = "/Script/UnrealEd.MaterialGraphNode";
const MATERIAL_ROOT_CLASS = "/Script/UnrealEd.MaterialGraphNode_Root";
const ROOT_INPUT_RULESET = "ue5-common-v1";

export function isMaterialGraphNodeClass(className: string | undefined): boolean {
    return Boolean(className && (
        className.startsWith(MATERIAL_NODE_PREFIX) ||
        /(?:^|\.)MaterialGraphNode(?:_|$)/.test(className)
    ));
}

export function isMaterialRootNodeClass(className: string | undefined): boolean {
    return Boolean(className && (
        className === MATERIAL_ROOT_CLASS ||
        /(?:^|\.)MaterialGraphNode_Root(?:_|$)/.test(className)
    ));
}

const UI_ROOT_INPUTS: { [blendMode: string]: string[] } = {
    opaque: ["Final Color"],
    masked: ["Final Color", "Opacity Mask"],
    translucent: ["Final Color", "Opacity"],
    additive: ["Final Color", "Opacity"],
    modulate: ["Final Color", "Opacity"],
    alphacomposite: ["Final Color", "Opacity"],
    alphaholdout: ["Final Color", "Opacity"],
};

interface ObjectHeader {
    className?: string;
    nodeName?: string;
}

function parseObjectHeader(line: string): ObjectHeader {
    const classMatch = line.match(/(?:^|\s)Class=(?:"([^"]+)"|([^\s]+))/);
    const nameMatch = line.match(/(?:^|\s)Name=(?:"([^"]+)"|([^\s]+))/);
    return {
        className: classMatch?.[1] || classMatch?.[2],
        nodeName: nameMatch?.[1] || nameMatch?.[2],
    };
}

function parsePinName(line: string): string | undefined {
    const match = line.match(/(?:^|,)PinName=(?:"((?:\\.|[^"])*)"|([^,)]+))/);
    const value = match?.[1] || match?.[2];
    return value?.replace(/\\"/g, '"').trim() || undefined;
}

function unique(values: Array<string | undefined>): string[] {
    return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function normalizeEnum(value: string | undefined, prefix: string): string | undefined {
    if (!value) return undefined;
    let normalized = value.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (normalized.startsWith(prefix)) normalized = normalized.substring(prefix.length);
    return normalized || undefined;
}

function parseSerializedProperty(lines: string[], names: string[]): string | undefined {
    for (const line of lines) {
        for (const name of names) {
            if (!line.startsWith(`${name}=`)) continue;
            const value = line.substring(name.length + 1).trim().replace(/^"|"$/g, '');
            if (value) return value;
        }
    }
    return undefined;
}

function resolveSetting<T extends string | boolean>(
    label: string,
    serialized: T | undefined,
    authored: T | undefined,
    diagnostics: KleeDiagnostic[],
    canonicalize: (value: T) => string = value => String(value).toLowerCase(),
): { value?: T; provenance: "serialized" | "authored" | "unknown" } {
    if (serialized !== undefined) {
        if (authored !== undefined && canonicalize(serialized) !== canonicalize(authored)) {
            diagnostics.push({
                code: "material-setting-conflict",
                severity: "warning",
                message: `Serialized ${label} '${serialized}' overrides conflicting authored value '${authored}'.`,
            });
        }
        return { value: serialized, provenance: "serialized" };
    }
    if (authored !== undefined) return { value: authored, provenance: "authored" };
    return { provenance: "unknown" };
}

function resolveMaterialHints(graphHints: KleeAuthoredGraphHints | undefined): KleeAuthoredMaterialHints {
    if (!graphHints) return {};
    const direct: KleeAuthoredMaterialHints = {};
    if (graphHints.domain !== undefined) direct.domain = graphHints.domain;
    if (graphHints.blendMode !== undefined) direct.blendMode = graphHints.blendMode;
    if (graphHints.shadingModel !== undefined) direct.shadingModel = graphHints.shadingModel;
    if (graphHints.useMaterialAttributes !== undefined) direct.useMaterialAttributes = graphHints.useMaterialAttributes;
    if (graphHints.unrealVersion !== undefined) direct.unrealVersion = graphHints.unrealVersion;
    if (Array.isArray(graphHints.rootInputs)) direct.rootInputs = graphHints.rootInputs;
    return { ...direct, ...(graphHints.material || {}) };
}

function resolveRootInputPolicy(
    hints: KleeAuthoredMaterialHints,
    serializedRootInputs: string[],
    diagnostics: KleeDiagnostic[],
): KleeRootInputPolicy {
    if (Array.isArray(hints.rootInputs)) {
        const requested = unique((hints.rootInputs || []).map(input => input.trim()));
        const serializedByKey = new Map(serializedRootInputs.map(input => [input.toLowerCase(), input]));
        const activeInputs = requested
            .map(input => serializedByKey.get(input.toLowerCase()))
            .filter((input): input is string => Boolean(input));
        const missing = requested.filter(input => !serializedByKey.has(input.toLowerCase()));
        if (missing.length > 0) {
            diagnostics.push({
                code: "root-input-not-serialized",
                severity: "warning",
                message: `Authored root inputs were not present in the pasted graph: ${missing.join(", ")}.`,
            });
        }
        if (activeInputs.length === 0) {
            diagnostics.push({
                code: "root-input-policy-no-match",
                severity: "warning",
                message: "None of the authored root inputs were present, so serialized root pins were left unchanged.",
            });
            return {
                mode: "unfiltered",
                reason: "The authored rootInputs list did not match a serialized root pin.",
            };
        }
        return {
            mode: "explicit",
            activeInputs: unique(activeInputs),
            reason: "Using the authored rootInputs list, intersected with the serialized root pins.",
        };
    }

    const versionMajor = hints.unrealVersion?.trim().match(/^(?:UE\s*)?(\d+)/i)?.[1];
    if (hints.unrealVersion && !versionMajor) {
        return {
            mode: "unfiltered",
            reason: `Unreal version '${hints.unrealVersion}' was not recognized; serialized root pins were left unchanged.`,
        };
    }
    if (versionMajor && versionMajor !== "5") {
        return {
            mode: "unfiltered",
            reason: `No conservative root-input table is available for Unreal ${hints.unrealVersion}.`,
        };
    }

    if (hints.useMaterialAttributes === true) {
        const activeInputs = serializedRootInputs.filter(input => input.toLowerCase() === "material attributes");
        if (activeInputs.length === 0) {
            diagnostics.push({
                code: "root-input-policy-no-match",
                severity: "warning",
                message: "Use Material Attributes was supplied, but no Material Attributes root pin was serialized; root pins were left unchanged.",
            });
            return {
                mode: "unfiltered",
                reason: "No serialized Material Attributes root pin was available.",
            };
        }
        return {
            mode: "table",
            activeInputs,
            ruleset: ROOT_INPUT_RULESET,
            reason: "Use Material Attributes was authored, so only the serialized Material Attributes input is active.",
        };
    }

    const domain = normalizeEnum(hints.domain, "md");
    const blendMode = normalizeEnum(hints.blendMode, "blend");
    if ((domain === "ui" || domain === "userinterface") && blendMode && UI_ROOT_INPUTS[blendMode]) {
        const allowed = new Set(UI_ROOT_INPUTS[blendMode].map(input => input.toLowerCase()));
        const activeInputs = serializedRootInputs.filter(input => allowed.has(input.toLowerCase()));
        if (activeInputs.length === 0) {
            diagnostics.push({
                code: "root-input-policy-no-match",
                severity: "warning",
                message: "The UI Material rule did not match a serialized root pin, so root pins were left unchanged.",
            });
            return {
                mode: "unfiltered",
                reason: `The ${ROOT_INPUT_RULESET} UI root-input rule matched no serialized pin.`,
            };
        }
        return {
            mode: "table",
            activeInputs,
            ruleset: ROOT_INPUT_RULESET,
            reason: `Applied the conservative ${ROOT_INPUT_RULESET} UI/${hints.blendMode} root-input table.`,
        };
    }

    return {
        mode: "unfiltered",
        reason: "Material metadata was insufficient or unsupported; serialized root pins were left unchanged.",
    };
}

function isBlueprintClass(className: string): boolean {
    return className.includes(".K2Node_") || className.startsWith("/Script/BlueprintGraph.") ||
        className.startsWith("/Script/UMGEditor.") || className.startsWith("/Script/AnimGraph.");
}

function isCompatibleHint(detected: KleeGraphKind, hint: KleeGraphKind): boolean {
    if (detected === "unknown") return true;
    const materialKinds: KleeGraphKind[] = ["material", "material-function", "material-fragment"];
    return detected === hint || (detected === "material-fragment" && materialKinds.includes(hint));
}

export function inspectUnrealGraph(source: string, graphHints?: KleeAuthoredGraphHints): KleeGraphInspection {
    const diagnostics: KleeDiagnostic[] = [];
    const lines = source.replace(/\r/g, '').split('\n').map(line => line.trim());
    const nodeClasses: string[] = [];
    const serializedRootInputs: string[] = [];
    let nodeCount = 0;
    let materialNodes = 0;
    let blueprintNodes = 0;
    let hasFunctionBoundary = false;
    let rootNodeName: string | undefined;
    const materialSettingLines: string[] = [];

    for (let index = 0; index < lines.length; ++index) {
        if (!lines[index].startsWith("Begin Object")) continue;
        try {
            const block = readUnrealObjectBlock(lines, index);
            const header = parseObjectHeader(block.lines[0]);
            index = block.endLineIndex;
            if (!header.className) continue;

            nodeCount += 1;
            nodeClasses.push(header.className);
            if (isMaterialGraphNodeClass(header.className)) {
                materialNodes += 1;
                if (isMaterialRootNodeClass(header.className)) {
                    rootNodeName = header.nodeName;
                    materialSettingLines.push(...block.lines);
                    for (const line of block.lines) {
                        if (!line.startsWith("CustomProperties Pin")) continue;
                        const pinName = parsePinName(line);
                        if (pinName) serializedRootInputs.push(pinName);
                    }
                }
                hasFunctionBoundary = hasFunctionBoundary || block.lines.some(line =>
                    /MaterialExpressionFunction(?:Input|Output)/.test(line));
            } else if (isBlueprintClass(header.className)) {
                blueprintNodes += 1;
            } else if (/(?:^|\.)\w*Material$/.test(header.className) || /(?:^|\.)PreviewMaterial$/.test(header.className)) {
                materialSettingLines.push(...block.lines);
            }
        } catch (error) {
            diagnostics.push({
                code: "graph-inspection-object-invalid",
                severity: "error",
                message: error instanceof Error ? error.message : String(error),
            });
        }
    }

    let detectedKind: KleeGraphKind = "unknown";
    if (materialNodes > 0 && blueprintNodes > 0) detectedKind = "mixed";
    else if (materialNodes > 0 && rootNodeName) detectedKind = "material";
    else if (materialNodes > 0 && hasFunctionBoundary) detectedKind = "material-function";
    else if (materialNodes > 0) detectedKind = "material-fragment";
    else if (blueprintNodes > 0) detectedKind = "blueprint";

    let kind = detectedKind;
    if (graphHints?.kind) {
        if (isCompatibleHint(detectedKind, graphHints.kind)) {
            kind = graphHints.kind;
        } else {
            diagnostics.push({
                code: "graph-kind-hint-conflict",
                severity: "warning",
                message: `Authored graph kind '${graphHints.kind}' conflicts with detected kind '${detectedKind}' and was ignored.`,
            });
        }
    }

    const materialKinds: KleeGraphKind[] = ["material", "material-function", "material-fragment"];
    const materialFamily = materialKinds.includes(kind);
    const authoredMaterialHints = resolveMaterialHints(graphHints);
    const serializedUseMaterialAttributesRaw = parseSerializedProperty(materialSettingLines, ["bUseMaterialAttributes", "UseMaterialAttributes"]);
    const serializedUseMaterialAttributes = serializedUseMaterialAttributesRaw === undefined
        ? undefined
        : serializedUseMaterialAttributesRaw.toLowerCase() === "true";
    const domain = resolveSetting("Material Domain",
        parseSerializedProperty(materialSettingLines, ["MaterialDomain"]), authoredMaterialHints.domain, diagnostics,
        value => normalizeEnum(value, "md") || "");
    const blendMode = resolveSetting("Blend Mode",
        parseSerializedProperty(materialSettingLines, ["BlendMode"]), authoredMaterialHints.blendMode, diagnostics,
        value => normalizeEnum(value, "blend") || "");
    const shadingModel = resolveSetting("Shading Model",
        parseSerializedProperty(materialSettingLines, ["ShadingModel"]), authoredMaterialHints.shadingModel, diagnostics,
        value => normalizeEnum(value, "msm") || "");
    const useMaterialAttributes = resolveSetting("Use Material Attributes",
        serializedUseMaterialAttributes, authoredMaterialHints.useMaterialAttributes, diagnostics);
    const unrealVersion = resolveSetting("Unreal Version",
        parseSerializedProperty(materialSettingLines, ["UnrealVersion", "EngineVersion", "EngineVersionString"]),
        authoredMaterialHints.unrealVersion, diagnostics);
    const resolvedMaterialHints: KleeAuthoredMaterialHints = {
        domain: domain.value,
        blendMode: blendMode.value,
        shadingModel: shadingModel.value,
        useMaterialAttributes: useMaterialAttributes.value,
        unrealVersion: unrealVersion.value,
    };
    if (Array.isArray(authoredMaterialHints.rootInputs)) resolvedMaterialHints.rootInputs = authoredMaterialHints.rootInputs;
    const rootInputPolicy = resolveRootInputPolicy(resolvedMaterialHints, unique(serializedRootInputs), diagnostics);
    if (!rootNodeName && rootInputPolicy.mode !== "unfiltered") {
        diagnostics.push({
            code: "root-input-policy-without-root",
            severity: "warning",
            message: "Authored root-input metadata was supplied, but this graph has no Material root node.",
        });
    }

    const previewDiagnostics: KleeDiagnostic[] = [];
    if (!materialFamily) {
        previewDiagnostics.push({
            code: "preview-material-only",
            severity: "info",
            message: "Preview targets are available only for Material-family graphs.",
        });
    } else {
        previewDiagnostics.push({
            code: "preview-renderer-unavailable",
            severity: "info",
            message: "Klee can mark a Material preview target, but this build does not render Material pixels.",
        });
        if (!rootNodeName) {
            previewDiagnostics.push({
                code: "preview-root-unavailable",
                severity: "info",
                message: "No Material root node was pasted, so clearing a preview has no root target.",
            });
        }
    }

    return {
        kind,
        detectedKind,
        nodeClasses: unique(nodeClasses),
        nodeCount,
        rootNodeName,
        material: materialFamily || rootNodeName ? {
            domain: domain.value,
            blendMode: blendMode.value,
            shadingModel: shadingModel.value,
            useMaterialAttributes: useMaterialAttributes.value,
            unrealVersion: unrealVersion.value,
            provenance: {
                domain: domain.provenance,
                blendMode: blendMode.provenance,
                shadingModel: shadingModel.provenance,
                useMaterialAttributes: useMaterialAttributes.provenance,
                unrealVersion: unrealVersion.provenance,
            },
            serializedRootInputs: unique(serializedRootInputs),
            rootInputPolicy,
        } : undefined,
        preview: {
            targetSelectionAvailable: materialFamily,
            pixelRenderingAvailable: false,
            rootFallbackAvailable: Boolean(rootNodeName),
            diagnostics: previewDiagnostics,
        },
        diagnostics,
    };
}
