import { NodeControl } from "../controls/nodes/node.control";
import { BlueprintParserUtils } from "./blueprint-parser-utils";
import { NodeParserRegistry } from "./node-parser-registry";
import { GenericNodeParser } from "./node-parsers/generic-node.parser";
import { ParsingNodeData } from "./parsing-node-data";
import { readUnrealObjectBlock } from "./unreal-object-block";
import { KleeGraphInspection } from "../data/graph-inspection";

export class BlueprintParser {

    private readonly _OBJECT_STARTING_TAG = "Begin Object";
    private _lines: string[];
    /** The buffer exactly as pasted. Parsing uses the stripped copy; the node
     *  keeps these, so copying a selection reproduces Unreal's own text. */
    private _rawLines: string[];
    private _nodeParserRegistry: NodeParserRegistry;

    constructor() {

        this._nodeParserRegistry = new NodeParserRegistry();
        this._nodeParserRegistry.loadPlugins();
    }

    parseBlueprint(blueprintData: string, inspection?: KleeGraphInspection): Array<NodeControl> {

        let controls = new Array<NodeControl>();

        this._rawLines = blueprintData.replace(/\r/g, '').split('\n');
        this._lines = this._rawLines.map(line => BlueprintParserUtils.stripLine(line));

        for (let i = 0; i < this._lines.length; ++i) {
            const line = this._lines[i];
            if (line.startsWith(this._OBJECT_STARTING_TAG)) {
                const objectStart = i;
                let objectBlock;
                try {
                    objectBlock = readUnrealObjectBlock(this._lines, i);
                    i = objectBlock.endLineIndex;
                } catch (error) {
                    inspection?.diagnostics.push({
                        code: "node-object-invalid",
                        severity: "error",
                        message: error instanceof Error ? error.message : String(error),
                    });
                    break;
                }

                const sourceLines = this._rawLines.slice(objectStart, objectBlock.endLineIndex + 1);
                const parser = new GenericNodeParser(this._nodeParserRegistry);
                try {
                    controls.push(parser.parse(new ParsingNodeData(objectBlock.lines, inspection, sourceLines)));
                } catch (error) {
                    const nodeName = objectBlock.lines[0].match(/(?:^|\s)Name=(?:"([^"]+)"|([^\s]+))/)?.slice(1).find(Boolean);
                    inspection?.diagnostics.push({
                        code: "node-parser-fallback",
                        severity: "warning",
                        message: `A specialized node parser failed; Klee rendered its generic pins instead. ${error instanceof Error ? error.message : String(error)}`,
                        nodeName,
                    });
                    try {
                        controls.push(parser.parseFallback(new ParsingNodeData(objectBlock.lines, inspection, sourceLines)));
                    } catch (fallbackError) {
                        inspection?.diagnostics.push({
                            code: "node-skipped",
                            severity: "error",
                            message: `A node could not be rendered and was skipped. ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`,
                            nodeName,
                        });
                    }
                }
            }
        }

        return controls;
    }
}
