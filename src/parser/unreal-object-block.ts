const OBJECT_STARTING_TAG = "Begin Object";
const OBJECT_ENDING_TAG = "End Object";

export interface UnrealObjectBlock {
    lines: string[];
    endLineIndex: number;
    maximumDepth: number;
}

/**
 * Reads one balanced Unreal clipboard object, including any nested objects.
 * Input lines are expected to have already been trimmed by BlueprintParser.
 */
export function readUnrealObjectBlock(lines: string[], startLineIndex: number): UnrealObjectBlock {
    if (!lines[startLineIndex]?.startsWith(OBJECT_STARTING_TAG)) {
        throw new Error("Invalid blueprint text. Expected an object to start with 'Begin Object'");
    }

    const objectLines: string[] = [];
    let depth = 0;
    let maximumDepth = 0;

    for (let lineIndex = startLineIndex; lineIndex < lines.length; ++lineIndex) {
        const line = lines[lineIndex];

        if (line.startsWith(OBJECT_STARTING_TAG)) {
            depth += 1;
            maximumDepth = Math.max(maximumDepth, depth);
        }

        objectLines.push(line);

        if (line.startsWith(OBJECT_ENDING_TAG)) {
            depth -= 1;

            if (depth === 0) {
                return {
                    lines: objectLines,
                    endLineIndex: lineIndex,
                    maximumDepth,
                };
            }

            if (depth < 0) {
                break;
            }
        }
    }

    throw new Error("Invalid blueprint text. An 'Object' node was never closed. Missing 'End Object'");
}
