import { UnrealNodeClass } from "../data/classes/unreal-node-class";
import { NodeFriendlyNames } from "./node-friendly-names";
import { NodeParserMap } from "./node-parser-map";
import { NodeParserPlugin } from "./node-parser-plugin";
import { CallFunctionNodeParser } from "./node-parsers/call-function-node.parser";
import { CommentNodeParser } from "./node-parsers/comment-node.parser";
import { CreateObjectNodeParser } from "./node-parsers/create-object-node.parser";
import { CreateWidgetNodeParser } from "./node-parsers/create-widget-node.parser";
import { CustomEventNodeParser } from "./node-parsers/custom-event-node.parser";
import { DynamicCastNodeParser } from "./node-parsers/dynamic-cast-node.parser";
import { EventNodeParser } from "./node-parsers/event-node.parser";
import { FlowControlNodeParser } from "./node-parsers/flow-control-node.parser";
import { FunctionEntryNodeParser } from "./node-parsers/function-entry-node.parser";
import { GetArrayItemNodeParser } from "./node-parsers/get-array-item-node.parser";
import { GetInputAxisKeyValueNodeParser } from "./node-parsers/get-input-axis-key-value-node.parser";
import { InputAxisNodeParser } from "./node-parsers/input-axis-node.parser";
import { InputKeyNodeParser } from "./node-parsers/input-key-node.parser";
import { InputTouchNodeParser } from "./node-parsers/input-touch-node.parser";
import { KnotNodeParser } from "./node-parsers/knot-node.parser";
import { MacroInstanceNodeParser } from "./node-parsers/macro-instance-node.parser";
import { MakeArrayNodeParser } from "./node-parsers/make-array-node.parser";
import { SelectNodeParser } from "./node-parsers/select-node.parser";
import { SpawnActorNodeParser } from "./node-parsers/spawn-actor-node.parser";
import { StructNodeParser } from "./node-parsers/struct-node.parser";
import { SwitchEnumNodeParser } from "./node-parsers/switch-enum-node.parser";
import { TimelineNodeParser } from "./node-parsers/timeline-node.parser";
import { TunnelNodeParser } from "./node-parsers/tunnel-node.parser";
import { VariableNodeParser } from "./node-parsers/variable-node.parser";
import { NodeParser } from "./node.parser";
import { MaterialGraphNodeParser } from "./node-parsers/material-graph-node.parser";


export class NodeParserRegistry {

    private _nodeParsers: NodeParserMap = {
        [UnrealNodeClass.KNOT]: () => new KnotNodeParser(),
        [UnrealNodeClass.CALL_FUNCTION]: () => new CallFunctionNodeParser(),
        [UnrealNodeClass.IF_THEN_ELSE]: () => new FlowControlNodeParser(),
        [UnrealNodeClass.EXECUTION_SEQUENCE]: () => new FlowControlNodeParser(),
        [UnrealNodeClass.MULTI_GATE]: () => new FlowControlNodeParser(),
        [UnrealNodeClass.VARIABLE_GET]: () => new VariableNodeParser(),
        [UnrealNodeClass.VARIABLE_SET]: () => new VariableNodeParser(),
        [UnrealNodeClass.EVENT]: () => new EventNodeParser(),
        [UnrealNodeClass.CUSTOM_EVENT]: () => new CustomEventNodeParser(),
        [UnrealNodeClass.INPUT_AXIS_EVENT]: () => new InputAxisNodeParser(),
        [UnrealNodeClass.COMMENT]: () => new CommentNodeParser(),
        [UnrealNodeClass.INPUT_KEY]: () => new InputKeyNodeParser(),
        [UnrealNodeClass.CommutativeAssociativeBinaryOperator]: () => new CallFunctionNodeParser(),
        [UnrealNodeClass.DYNAMIC_CAST]: () => new DynamicCastNodeParser(),
        [UnrealNodeClass.SWITCH_ENUM]: () => new SwitchEnumNodeParser(),
        [UnrealNodeClass.MACRO_INSTANCE]: () => new MacroInstanceNodeParser(),
        [UnrealNodeClass.FUNCTION_ENTRY]: () => new FunctionEntryNodeParser(),
        [UnrealNodeClass.FUNCTION_RESULT]: () => new FunctionEntryNodeParser(),
        [UnrealNodeClass.CALL_ARRAY_FUNCTION]: () => new CallFunctionNodeParser(),
        [UnrealNodeClass.SELF]: () => new VariableNodeParser(),
        [UnrealNodeClass.GET_ARRAY_ITEM]: () => new GetArrayItemNodeParser(),
        [UnrealNodeClass.MAKE_ARRAY]: () => new MakeArrayNodeParser(),
        [UnrealNodeClass.INPUT_TOUCH]: () => new InputTouchNodeParser(),
        [UnrealNodeClass.GET_INPUT_AXIS_KEY_VALUE]: () => new GetInputAxisKeyValueNodeParser(),
        [UnrealNodeClass.SET_FIELDS_IN_STRUCT]: () => new StructNodeParser(),
        [UnrealNodeClass.BREAK_STRUCT]: () => new StructNodeParser(),
        [UnrealNodeClass.MAKE_STRUCT]: () => new StructNodeParser(),
        [UnrealNodeClass.SELECT]: () => new SelectNodeParser(),
        [UnrealNodeClass.TIMELINE]: () => new TimelineNodeParser(),
        [UnrealNodeClass.SPAWN_ACTOR_FROM_CLASS]: () => new SpawnActorNodeParser(),
        [UnrealNodeClass.TUNNEL]: () => new TunnelNodeParser(),
        [UnrealNodeClass.CREATE_WIDGET]: () => new CreateWidgetNodeParser(),
        [UnrealNodeClass.CREATE_OBJECT]: () => new CreateObjectNodeParser(),
        [UnrealNodeClass.MATERIAL_GRAPH_NODE]: () => new MaterialGraphNodeParser(),
        [UnrealNodeClass.MATERIAL_GRAPH_NODE_CUSTOM]: () => new MaterialGraphNodeParser(),
        [UnrealNodeClass.MATERIAL_GRAPH_NODE_ROOT]: () => new MaterialGraphNodeParser(),
    }

    public constructor() {}

    public loadPlugins(): void {
        const pluginContext = (require as any).context('../../plugins', true, /\.plugin\.ts$/);
        const pluginPaths = pluginContext.keys();

        for (let pluginPath of pluginPaths) {
            try {
                const pluginModule : NodeParserPlugin = pluginContext(pluginPath);
                
                for (const exportKey of Object.keys(pluginModule)) {
                    const pluginName = exportKey;
                    const plugin : NodeParserPlugin = pluginModule[exportKey];
                    this.registerPlugin(plugin, pluginName)
                }
            } catch (error) {
                console.error(`Error loading plugin ${pluginPath}:`, error);
            }
        }
    }

    private registerPlugin(plugin: NodeParserPlugin, pluginName: string) {
        if (plugin.getNodeParsers && typeof plugin.getNodeParsers === 'function') {
            let parsers: NodeParserMap = plugin.getNodeParsers();
            if (parsers) {
                let registeredNodeParsers = []

                for (const [nodeClass, parser] of Object.entries(parsers)) {
                    this._nodeParsers[nodeClass] = parser;
                    registeredNodeParsers.push(nodeClass)
                }

                console.info(`[Klee] Plugin '${pluginName}' registered node parsers: [${registeredNodeParsers.join(',')}]`);
            }
        }

        if (plugin.getFriendlyNodeNames && typeof plugin.getFriendlyNodeNames === 'function') {
            let friendlyNames = plugin.getFriendlyNodeNames();
            if (friendlyNames) {
                let registeredFriendlyNames = []

                for (const [key, value] of Object.entries(friendlyNames)) {
                    NodeFriendlyNames[key] = value as string;
                    registeredFriendlyNames.push(key)
                }

                console.info(`[Klee] Plugin '${pluginName}' registered friendly names: [${registeredFriendlyNames.join(',')}]`);
            }
        }


    }


    public getParser(nodeClass: UnrealNodeClass): (() => NodeParser) | undefined {
        return this._nodeParsers[nodeClass];
    }
}
