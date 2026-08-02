import { KleeDiagnostic } from "./data/graph-inspection";
import { GraphReference } from "./data/graph-reference";

export const KLEE_NODE_ACTIVATE_EVENT = "klee:nodeactivate";
export const KLEE_PREVIEW_CHANGE_EVENT = "klee:previewchange";

/** Serializable payload emitted when a rendered node is activated. */
export interface KleeNodeActivateDetail {
    nodeName: string;
    nodeClass: string;
    title: string;
    expressionClass?: string;
    assetName?: string;
    objectPath?: string;
    reference?: GraphReference;
    references?: GraphReference[];
}

/** Preview target state. Pixel rendering is intentionally a separate host capability. */
export interface KleePreviewChangeDetail {
    active: boolean;
    isPreviewing: boolean;
    nodeName?: string;
    title?: string;
    rootNodeName?: string;
    pixelRenderingAvailable: false;
    diagnostics: KleeDiagnostic[];
    reason?: "preview-selected" | "cleared" | "toggled-off" | "root-selected" |
        "no-selection" | "multiple-selection" | "unsupported-graph" | "unsupported-node";
}

declare global {
    interface HTMLElementEventMap {
        "klee:nodeactivate": CustomEvent<KleeNodeActivateDetail>;
        "klee:previewchange": CustomEvent<KleePreviewChangeDetail>;
    }
}
