import { NodeControl } from "../controls/nodes/node.control";
import { BlueprintParserUtils } from "./blueprint-parser-utils";
import { NodeParserRegistry } from "./node-parser-registry";
import { GenericNodeParser } from "./node-parsers/generic-node.parser";
import { ParsingNodeData } from "./parsing-node-data";
import { readUnrealObjectBlock } from "./unreal-object-block";

export class BlueprintParser {

    private readonly _OBJECT_STARTING_TAG = "Begin Object";
    private _lines: string[];
    private _nodeParserRegistry: NodeParserRegistry;

    constructor() {

        this._nodeParserRegistry = new NodeParserRegistry();
        this._nodeParserRegistry.loadPlugins();
    }

    parseBlueprint(blueprintData: string): Array<NodeControl> {

        let controls = new Array<NodeControl>();

        this._lines = blueprintData
            .replace(/\r/g, '')
            .split('\n')
            .map(line => BlueprintParserUtils.stripLine(line));

        for (let i = 0; i < this._lines.length; ++i) {
            const line = this._lines[i];
            if (line.startsWith(this._OBJECT_STARTING_TAG)) {
                const objectBlock = readUnrealObjectBlock(this._lines, i);
                i = objectBlock.endLineIndex;

                controls.push(new GenericNodeParser(this._nodeParserRegistry).parse(new ParsingNodeData(objectBlock.lines)));
            }
        }

        return controls;
    }
}
