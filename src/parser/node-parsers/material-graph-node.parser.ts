import { HeadedNodeControl } from "../../controls/nodes/headed-node-control";
import { NodeControl } from "../../controls/nodes/node.control";
import { NodeParser } from "../node.parser";
import { ParsingNodeData } from "../parsing-node-data";
import { resolveMaterialNodeMetadata } from "../material-node-metadata";

export class MaterialGraphNodeParser extends NodeParser {

    public parse(data: ParsingNodeData): NodeControl {
        const metadata = resolveMaterialNodeMetadata(data.lines, data.node.class);

        data.node.title = metadata.title;
        data.node.materialExpressionClass = metadata.expressionClass;
        data.node.materialFunction = metadata.materialFunction;

        return new HeadedNodeControl(data.node);
    }
}
