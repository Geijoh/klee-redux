import { Vector2 } from "../../math/vector2";
import { CustomProperty } from "../custom-property";
import { UnrealNodeClass } from "../classes/unreal-node-class";
import { MaterialFunctionReference } from "../material-function-reference";
import { GraphReference } from "../graph-reference";



export interface Node {
    class: UnrealNodeClass;
    name: string;
    title: string;
    subTitles?: Array<{
        orderIndex?: number,
        text: string
    }>;
    guid: string;
    pos: Vector2;
    sourceText: string;
    customProperties: CustomProperty[];
    backgroundColor?: string;
    advancedPinDisplay?: boolean;
    enabledState?: string;
    errorType?: number;
    errorMsg?: string;
    latent: boolean;
    materialExpressionClass?: string;
    materialFunction?: MaterialFunctionReference;
    references?: GraphReference[];
}
