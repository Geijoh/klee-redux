import { MaterialFunctionReference } from "../data/material-function-reference";

export interface MaterialNodeMetadata {
    title: string;
    expressionClass?: string;
    materialFunction?: MaterialFunctionReference;
    headerColor?: string;
}

/**
 * Material graphs have no execution model, so the header tint encodes the
 * expression's *output type* rather than a node role. These are the
 * UGraphEditorSettings defaults that UMaterialGraphNode::GetNodeTitleColor()
 * routes to, converted from linear to sRGB.
 */
const MATERIAL_HEADER_COLORS = {
    boolean: '149,0,0',       // BooleanPinTypeColor
    scalar: '161,255,69',     // FloatPinTypeColor
    vector: '255,202,35',     // VectorPinTypeColor
    object: '0,170,245',      // ObjectPinTypeColor
    functionCall: '121,201,255', // FunctionCallNodeTitleColor
    result: '255,211,170',    // ResultNodeTitleColor
    neutral: '154,154,154',   // Everything else stays neutral gray
};

const HEADER_COLOR_RULES: Array<{ test: RegExp; color: string }> = [
    { test: /^MaterialExpression(?:StaticBool|StaticSwitch|StaticBoolParameter|StaticSwitchParameter)$/, color: MATERIAL_HEADER_COLORS.boolean },
    { test: /^MaterialExpression(?:Constant|ScalarParameter)$/, color: MATERIAL_HEADER_COLORS.scalar },
    { test: /^MaterialExpression(?:Constant[234]Vector|VectorParameter)$/, color: MATERIAL_HEADER_COLORS.vector },
    { test: /^MaterialExpression(?:Texture|RuntimeVirtualTexture|SparseVolumeTexture)/, color: MATERIAL_HEADER_COLORS.object },
    { test: /^MaterialExpressionMaterialFunctionCall$/, color: MATERIAL_HEADER_COLORS.functionCall },
    { test: /^MaterialExpression(?:FunctionOutput|.*Output)$/, color: MATERIAL_HEADER_COLORS.result },
];

/** Returns the `r,g,b` header tint for a Material expression class. */
export function resolveMaterialHeaderColor(expressionClassName: string | undefined): string {
    if (!expressionClassName) return MATERIAL_HEADER_COLORS.neutral;
    for (const rule of HEADER_COLOR_RULES) {
        if (rule.test.test(expressionClassName)) return rule.color;
    }
    return MATERIAL_HEADER_COLORS.neutral;
}

export const MATERIAL_RESULT_HEADER_COLOR = MATERIAL_HEADER_COLORS.result;

const MATERIAL_EXPRESSION_PREFIX = "MaterialExpression";

const EDITOR_TITLES: { [expressionClassName: string]: string } = {
    MaterialExpressionAbs: "Abs",
    MaterialExpressionAdd: "Add",
    MaterialExpressionAppendVector: "Append",
    MaterialExpressionArccosine: "Arccosine",
    MaterialExpressionArcsine: "Arcsine",
    MaterialExpressionArctangent: "Arctangent",
    MaterialExpressionCeil: "Ceil",
    MaterialExpressionClamp: "Clamp",
    MaterialExpressionComponentMask: "Component Mask",
    MaterialExpressionConstant: "Constant",
    MaterialExpressionConstant2Vector: "Constant2Vector",
    MaterialExpressionConstant3Vector: "Constant3Vector",
    MaterialExpressionConstant4Vector: "Constant4Vector",
    MaterialExpressionCosine: "Cosine",
    MaterialExpressionCrossProduct: "Cross Product",
    MaterialExpressionCustom: "Custom",
    MaterialExpressionDDX: "DDX",
    MaterialExpressionDDY: "DDY",
    MaterialExpressionDistance: "Distance",
    MaterialExpressionDivide: "Divide",
    MaterialExpressionDotProduct: "Dot Product",
    MaterialExpressionFloor: "Floor",
    MaterialExpressionFrac: "Frac",
    MaterialExpressionFresnel: "Fresnel",
    MaterialExpressionIf: "If",
    MaterialExpressionLinearInterpolate: "Linear Interpolate",
    MaterialExpressionMax: "Max",
    MaterialExpressionMin: "Min",
    MaterialExpressionMultiply: "Multiply",
    MaterialExpressionNormalize: "Normalize",
    MaterialExpressionOneMinus: "OneMinus",
    MaterialExpressionPower: "Power",
    MaterialExpressionReflectionVectorWS: "Reflection Vector",
    MaterialExpressionRotateAboutAxis: "Rotate About Axis",
    MaterialExpressionRound: "Round",
    MaterialExpressionSaturate: "Saturate",
    MaterialExpressionSine: "Sine",
    MaterialExpressionSquareRoot: "Square Root",
    MaterialExpressionStep: "Step",
    MaterialExpressionSubtract: "Subtract",
    MaterialExpressionTextureCoordinate: "Texture Coordinate",
    MaterialExpressionTextureObject: "Texture Object",
    MaterialExpressionTextureSample: "Texture Sample",
    MaterialExpressionTime: "Time",
    MaterialExpressionTransform: "Transform",
    MaterialExpressionTransformPosition: "Transform Position",
    MaterialExpressionTruncate: "Truncate",
    MaterialExpressionVertexNormalWS: "Vertex Normal WS",
};

function findProperty(lines: string[], propertyNames: string[]): string | undefined {
    for (const line of lines) {
        for (const propertyName of propertyNames) {
            const prefix = `${propertyName}=`;
            if (line.startsWith(prefix)) {
                return line.substring(prefix.length).trim();
            }
        }
    }
    return undefined;
}

function parseSerializedString(value: string | undefined): string | undefined {
    if (!value) return undefined;

    let result = value.trim();
    if (result.startsWith('"') && result.endsWith('"')) {
        result = result.substring(1, result.length - 1);
    }

    result = result.replace(/\\"/g, '"').replace(/\\'/g, "'").trim();
    return result || undefined;
}

function parseObjectPath(value: string | undefined): string | undefined {
    if (!value) return undefined;

    const quotedPath = value.match(/'([^']+)'/);
    if (quotedPath) return parseSerializedString(quotedPath[1]);

    return parseSerializedString(value);
}

function getPackageAssetName(objectPath: string): string {
    const pathLeaf = objectPath.substring(objectPath.lastIndexOf('/') + 1);
    const objectSeparator = pathLeaf.indexOf('.');
    return objectSeparator >= 0 ? pathLeaf.substring(0, objectSeparator) : pathLeaf;
}

function getObjectName(objectPath: string): string {
    const pathLeaf = objectPath.substring(objectPath.lastIndexOf('/') + 1);
    const objectSeparator = pathLeaf.lastIndexOf('.');
    return objectSeparator >= 0 ? pathLeaf.substring(objectSeparator + 1) : pathLeaf;
}

function getExpressionClass(lines: string[]): string | undefined {
    for (const line of lines) {
        const nestedClass = line.match(/^Begin Object Class=(?:")?([^" ]*\.MaterialExpression[A-Za-z0-9_]+)(?:")?(?:\s|$)/);
        if (nestedClass) return nestedClass[1];
    }

    const expressionReference = findProperty(lines, ["MaterialExpression"]);
    if (!expressionReference) return undefined;

    const classReference = expressionReference.match(/(?:")?([^"']*\.MaterialExpression[A-Za-z0-9_]+)'/);
    return classReference?.[1];
}

function getExpressionClassName(expressionClass: string): string {
    return expressionClass.substring(expressionClass.lastIndexOf('.') + 1);
}

function humanizeExpressionClass(expressionClassName: string): string {
    const withoutPrefix = expressionClassName.startsWith(MATERIAL_EXPRESSION_PREFIX)
        ? expressionClassName.substring(MATERIAL_EXPRESSION_PREFIX.length)
        : expressionClassName;

    return withoutPrefix
        .replace(/_/g, ' ')
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/([A-Za-z])(\d)/g, '$1 $2')
        .replace(/(\d)([A-Za-z])/g, '$1 $2')
        .replace(/\s+/g, ' ')
        .trim() || expressionClassName;
}

function getMaterialFunction(lines: string[]): MaterialFunctionReference | undefined {
    const objectPath = parseObjectPath(findProperty(lines, ["MaterialFunction"]));
    if (!objectPath) return undefined;

    return {
        assetName: getPackageAssetName(objectPath),
        objectPath,
    };
}

function getRootMaterialTitle(lines: string[]): string {
    const objectPath = parseObjectPath(findProperty(lines, ["Material"]));
    return objectPath ? getObjectName(objectPath) : "Material Output";
}

/**
 * Resolves the caption information Unreal serializes inside a MaterialGraphNode.
 * Some editor captions are computed by Unreal and are not present in clipboard
 * text, so unknown expression classes intentionally use a readable fallback.
 */
export function resolveMaterialNodeMetadata(lines: string[], nodeClass: string): MaterialNodeMetadata {
    if (/(?:^|\.)MaterialGraphNode_Root(?:_|$)/.test(nodeClass)) {
        // The result node is an output, so it carries ResultNodeTitleColor.
        return { title: getRootMaterialTitle(lines), headerColor: MATERIAL_RESULT_HEADER_COLOR };
    }

    const expressionClass = getExpressionClass(lines);
    if (!expressionClass) {
        return { title: "Material Node", headerColor: resolveMaterialHeaderColor(undefined) };
    }

    const expressionClassName = getExpressionClassName(expressionClass);
    const headerColor = resolveMaterialHeaderColor(expressionClassName);
    const materialFunction = expressionClassName === "MaterialExpressionMaterialFunctionCall"
        ? getMaterialFunction(lines)
        : undefined;

    if (materialFunction) {
        return {
            title: materialFunction.assetName,
            expressionClass,
            materialFunction,
            headerColor,
        };
    }

    const parameterName = parseSerializedString(findProperty(lines, ["ParameterName"]));
    if (parameterName) {
        return { title: parameterName, expressionClass, headerColor };
    }

    const description = expressionClassName === "MaterialExpressionCustom"
        ? parseSerializedString(findProperty(lines, ["Description"]))
        : undefined;
    if (description) {
        return { title: description, expressionClass, headerColor };
    }

    return {
        title: EDITOR_TITLES[expressionClassName] || humanizeExpressionClass(expressionClassName),
        expressionClass,
        headerColor,
    };
}
