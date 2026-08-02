import { MacroGraphReference } from "../data/macro-graph-reference";
import { BlueprintParserUtils } from "./blueprint-parser-utils";


export class MacroGraphReferenceParser {

    parse(referenceString: string): MacroGraphReference {
        referenceString = referenceString.trim();
        referenceString = referenceString.substr(1, referenceString.length - 2);

        let dataRef: MacroGraphReference = {};

        const data = referenceString.split(',');

        for (let i = 0; i < data.length; ++i) {
            let dataSet = data[i].split('=');

            let key = dataSet[0];
            let value = dataSet[1];

            switch(key) {
                case "MacroGraph":
                    dataRef.macroGraphPath = MacroGraphReferenceParser.extractObjectPath(value);
                    dataRef.macroFuncName = MacroGraphReferenceParser.extractNodeNameOfMacroGraphStr(dataRef.macroGraphPath);
                    break;
                case "GraphBlueprint":
                    dataRef.graphBlueprintPath = MacroGraphReferenceParser.extractObjectPath(value);
                    break;
                case "GraphGuid":
                    dataRef.graphGuid = value;
                    break;
            }
        }

        return dataRef;
    }

    private static extractObjectPath(value: string): string {
        const quoted = value.match(/'"?([^']+?)"?'/);
        return quoted?.[1] || BlueprintParserUtils.parseString(value);
    }

    private static extractNodeNameOfMacroGraphStr(value: string): string {
        const separator = value.lastIndexOf(':');
        return separator >= 0 ? value.substring(separator + 1) : value;
    }
}
