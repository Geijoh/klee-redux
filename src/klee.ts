import { Application } from "./application";
import { KleeDisplayOptions, KleeGraphInspection } from "./data/graph-inspection";
import { KleePreviewChangeDetail } from "./events";

export {
    KLEE_NODE_ACTIVATE_EVENT,
    KLEE_PREVIEW_CHANGE_EVENT,
    KleeNodeActivateDetail,
    KleePreviewChangeDetail,
} from "./events";
export {
    KleeAuthoredGraphHints,
    KleeAuthoredMaterialHints,
    KleeDiagnostic,
    KleeDisplayOptions,
    KleeGraphInspection,
    KleeGraphKind,
    KleeMaterialInspection,
    KleePreviewCapability,
    KleeRootInputPolicy,
} from "./data/graph-inspection";
export { GraphReference, GraphReferenceKind } from "./data/graph-reference";

export class Klee {

    private app: Application;

    constructor(canvas: HTMLCanvasElement, app?: Application) {
        if (app !== undefined) {
            this.app = app;
        } else {
            this.app = Application.createOrGet(canvas);
        }
    }

    public display(blueprintText: string, options: KleeDisplayOptions = {}): KleeGraphInspection {
        return this.app.loadBlueprintIntoScene(blueprintText, options);
    }

    public get inspection(): KleeGraphInspection {
        return this.app.inspection;
    }

    public togglePreviewSelected(): KleePreviewChangeDetail {
        return this.app.togglePreviewSelected();
    }

    public clearPreview(): KleePreviewChangeDetail {
        return this.app.clearPreview();
    }

    public getPreviewState(): KleePreviewChangeDetail {
        return this.app.getPreviewState();
    }

    public static getInstance(canvas: HTMLCanvasElement) {
        let app = Application.getInstance(canvas);
        if (app !== undefined) {
            return new Klee(canvas, app);
        }
        return undefined;
    }

    public get value(): string {
        return this.app.getBlueprint();
    }
}

export function init(canvas: HTMLCanvasElement) {
    return new Klee(canvas);
}

export function get(canvas: HTMLCanvasElement) {
    return Klee.getInstance(canvas);
}





function initialize() {
    document.querySelectorAll('canvas.klee').forEach((canvas: HTMLCanvasElement) => {
        new Klee(canvas);
    });
}

window.addEventListener("load", initialize);
