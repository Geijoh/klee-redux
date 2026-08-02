import { NodeDataReference } from "./node-data-reference";

/** A serializable reference from one Unreal graph node to another authored graph. */
export type GraphReferenceKind =
    | "material-function"
    | "blueprint-function"
    | "blueprint-macro"
    | "collapsed-graph";

export interface GraphReference {
    kind: GraphReferenceKind;
    displayName: string;
    assetName?: string;
    objectPath?: string;
    graphName?: string;
    memberName?: string;
    guid?: string;
    selfContext?: boolean;
    builtin?: boolean;
    navigable?: boolean;
}

export function getAssetNameFromObjectPath(objectPath: string | undefined): string | undefined {
    if (!objectPath) return undefined;
    const pathLeaf = objectPath.substring(objectPath.lastIndexOf('/') + 1);
    const objectSeparator = pathLeaf.indexOf('.');
    const assetName = objectSeparator >= 0 ? pathLeaf.substring(0, objectSeparator) : pathLeaf;
    return assetName.replace(/_C$/, '') || undefined;
}

export function createBlueprintFunctionReference(
    dataReference: NodeDataReference,
    displayName?: string,
): GraphReference {
    const objectPath = dataReference.memberParent?.classPath;
    const memberName = dataReference.memberName;
    return {
        kind: "blueprint-function",
        displayName: displayName || memberName || "Blueprint Function",
        assetName: getAssetNameFromObjectPath(objectPath),
        objectPath,
        graphName: memberName,
        memberName,
        guid: dataReference.memberGUID,
        selfContext: dataReference.selfContext,
        builtin: Boolean(objectPath?.startsWith("/Engine/") || objectPath?.startsWith("/Script/")),
        navigable: Boolean(dataReference.selfContext || (objectPath && !objectPath.startsWith("/Script/"))),
    };
}

export function parseGraphObjectReference(value: string): {
    objectPath?: string;
    graphName?: string;
} {
    const quoted = value.match(/'"?([^']+?)"?'/);
    let fullPath = quoted?.[1] || value.trim().replace(/^"|"$/g, '');
    fullPath = fullPath.replace(/^"|"$/g, '');
    const graphSeparator = fullPath.lastIndexOf(':');
    if (graphSeparator < 0) return { objectPath: fullPath || undefined };
    return {
        objectPath: fullPath.substring(0, graphSeparator) || undefined,
        graphName: fullPath.substring(graphSeparator + 1) || undefined,
    };
}
