export const KLEE_NODE_ACTIVATE_EVENT = "klee:nodeactivate";

/** Serializable payload emitted when a rendered node is activated. */
export interface KleeNodeActivateDetail {
    nodeName: string;
    nodeClass: string;
    title: string;
    expressionClass?: string;
    assetName?: string;
    objectPath?: string;
}

declare global {
    interface HTMLElementEventMap {
        "klee:nodeactivate": CustomEvent<KleeNodeActivateDetail>;
    }
}
