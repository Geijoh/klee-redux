import { HeadedNodeControl } from "../../controls/nodes/headed-node-control";
import { NodeControl } from "../../controls/nodes/node.control";
import { NodeParser } from "../node.parser";
import { ParsingNodeData } from "../parsing-node-data";
import { resolveMaterialNodeMetadata } from "../material-node-metadata";
import { GraphReference, isEngineOwnedPath, isNativeScriptPath } from "../../data/graph-reference";
import { isMaterialRootNodeClass } from "../graph-inspector";

export class MaterialGraphNodeParser extends NodeParser {

    public parse(data: ParsingNodeData): NodeControl {
        const metadata = resolveMaterialNodeMetadata(data.lines, data.node.class);

        if (metadata.expressionClass || isMaterialRootNodeClass(data.node.class)) {
            data.node.title = metadata.title;
        }
        if (metadata.headerColor) data.node.backgroundColor = metadata.headerColor;
        data.node.materialExpressionClass = metadata.expressionClass;
        data.node.materialFunction = metadata.materialFunction;

        if (metadata.materialFunction) {
            const reference: GraphReference = {
                kind: "material-function",
                displayName: metadata.materialFunction.assetName,
                assetName: metadata.materialFunction.assetName,
                objectPath: metadata.materialFunction.objectPath,
                builtin: isEngineOwnedPath(metadata.materialFunction.objectPath),
                navigable: !isNativeScriptPath(metadata.materialFunction.objectPath),
            };
            data.node.references = [reference];
        }

        return new HeadedNodeControl(data.node);
    }
}
