export type KleeGraphKind =
    | "blueprint"
    | "material"
    | "material-function"
    | "material-fragment"
    | "mixed"
    | "unknown";

export type KleeDiagnosticSeverity = "info" | "warning" | "error";

export interface KleeDiagnostic {
    code: string;
    severity: KleeDiagnosticSeverity;
    message: string;
    nodeName?: string;
}

export interface KleeAuthoredMaterialHints {
    domain?: string;
    blendMode?: string;
    shadingModel?: string;
    useMaterialAttributes?: boolean;
    unrealVersion?: string;
    /** Exact editor-facing root input names. An explicit list overrides built-in rules. */
    rootInputs?: string[];
}

export interface KleeAuthoredGraphHints extends KleeAuthoredMaterialHints {
    kind?: KleeGraphKind;
    material?: KleeAuthoredMaterialHints;
}

export interface KleeDisplayOptions {
    graph?: KleeAuthoredGraphHints;
}

export interface KleeRootInputPolicy {
    mode: "explicit" | "table" | "unfiltered";
    activeInputs?: string[];
    ruleset?: string;
    reason: string;
}

export interface KleeMaterialInspection {
    domain?: string;
    blendMode?: string;
    shadingModel?: string;
    useMaterialAttributes?: boolean;
    unrealVersion?: string;
    provenance: {
        domain: "serialized" | "authored" | "unknown";
        blendMode: "serialized" | "authored" | "unknown";
        shadingModel: "serialized" | "authored" | "unknown";
        useMaterialAttributes: "serialized" | "authored" | "unknown";
        unrealVersion: "serialized" | "authored" | "unknown";
    };
    serializedRootInputs: string[];
    rootInputPolicy: KleeRootInputPolicy;
}

export interface KleePreviewCapability {
    targetSelectionAvailable: boolean;
    pixelRenderingAvailable: false;
    rootFallbackAvailable: boolean;
    diagnostics: KleeDiagnostic[];
}

export interface KleeGraphInspection {
    kind: KleeGraphKind;
    detectedKind: KleeGraphKind;
    nodeClasses: string[];
    nodeCount: number;
    rootNodeName?: string;
    material?: KleeMaterialInspection;
    preview: KleePreviewCapability;
    diagnostics: KleeDiagnostic[];
}
