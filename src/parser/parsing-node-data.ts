import { Node } from '../data/nodes/node';
import { KleeGraphInspection } from '../data/graph-inspection';

export class ParsingNodeData {

    private _node: Node;
    private _lines: string[];
    private _unparsedLines: string[];
    private _graphInspection?: KleeGraphInspection;
    private _sourceLines: string[];

    constructor(lines: string[], graphInspection?: KleeGraphInspection, sourceLines?: string[]) {
        this._lines = Array.from(lines);
        this._unparsedLines = lines.slice(1, lines.length - 1);
        this._graphInspection = graphInspection;
        this._sourceLines = Array.from(sourceLines || lines);
    }

    /** The node's original text, indentation included. */
    public get sourceLines(): string[] {
        return this._sourceLines;
    }

    public get node(): Node {
        return this._node;
    }

    public set node(value: Node) {
        this._node = value;
    }

    public get lines(): string[] {
        return this._lines;
    }

    public get unparsedLines(): string[] {
        return this._unparsedLines;
    }

    public get graphInspection(): KleeGraphInspection | undefined {
        return this._graphInspection;
    }
}
