import { Canvas2D } from "./canvas";
import { Controller } from "./controller";
import { Overlay } from "./overlay";
import { BlueprintParser } from "./parser/blueprint-parser";
import { Scene } from "./scene";
import { Vector2 } from "./math/vector2";
import { decodeBlueprintFromHash, decodeBlueprintFromHashAsync, encodeBlueprintToHash } from "./utils/share-utils";
import { KleeDisplayOptions, KleeGraphInspection } from "./data/graph-inspection";
import { inspectUnrealGraph, isMaterialGraphNodeClass } from "./parser/graph-inspector";
import { KLEE_PREVIEW_CHANGE_EVENT, KleePreviewChangeDetail } from "./events";

export class Application {

    private _scene: Scene;
    private _canvas: Canvas2D;

    private _controller: Controller;
    private _parser: BlueprintParser;
    private _element: HTMLCanvasElement;
    private _overlay: Overlay;
    private _inspection: KleeGraphInspection;
    private _previewNodeName?: string;

    private static firefox: boolean;
    private static instances: Array<Application> = [];

    private allowPaste: boolean;
    private _embedMode: boolean = false;

    private _animationTime: number = 0;
    private _animationEnabled: boolean = true;
    private _animationStartedAt: number = 0;
    private _animationRafId: number = 0;

    private constructor(element: HTMLCanvasElement) {
        this._element = element;

        if (navigator.userAgent.indexOf("Firefox") > 0) {
            Application.firefox = true;
        }


        this._canvas = new Canvas2D(element);
        this._scene = new Scene(this._canvas, this);

        this.initializeHtmlAttributes();

        this._parser = new BlueprintParser();

        const initialBlueprint = this.resolveInitialBlueprint(element.innerHTML);
        this.loadBlueprintIntoScene(initialBlueprint);

        this._controller = new Controller(element, this);
        this._overlay = new Overlay(this);

        this.maybeLoadCompressedShareAsync();
        this.startAnimationLoop();
        this._controller.registerAction({
            ctrl: true,
            keycode: 'KeyC',
            callback: this.copyBlueprintSelectionToClipboard.bind(this)
        });
        this._controller.registerAction({
            ctrl: false,
            keycode: 'Home',
            callback: this.recenterCamera.bind(this),
        })

        this._controller.registerAction({
            ctrl: true,
            keycode: 'KeyV',
            callback: this.pasteClipboardContentToCanvas.bind(this)
        });
        this._controller.registerAction({
            ctrl: false,
            keycode: 'KeyW',
            callback: (event) => {
                if (event.altKey || event.metaKey || event.shiftKey || event.repeat) return false;
                if (!this._inspection?.preview.targetSelectionAvailable) return false;
                this.togglePreviewSelected();
                return true;
            },
        });
        this._element.onpaste = (ev) => this.onPaste(ev);

        window.addEventListener('resize', this.refresh.bind(this), false);
    }

    get scene() {
        return this._scene;
    }

    get canvas() {
        return this._canvas;
    }

    public get inspection(): KleeGraphInspection {
        return this._inspection;
    }

    static get isFirefox() {
        return this.firefox;
    }

    public getBlueprint(): string {
        let textLines = [];
        this._scene.nodes.forEach(n => textLines = [].concat(textLines, n.sourceText));
        return textLines.join('\n');
    }

    private initializeHtmlAttributes() {
        let attrPaste = this._element.getAttributeNode("data-klee-paste");
        this.allowPaste = attrPaste?.value == "true" || false;

        try {
            const params = new URLSearchParams(window.location.search);
            if (params.get("embed") === "1" || this._element.getAttribute("data-klee-embed") === "true") {
                this._embedMode = true;
            }
        } catch (e) {
            // URLSearchParams unavailable — ignore
        }
    }

    private resolveInitialBlueprint(fallback: string): string {
        try {
            const hash = window.location.hash || "";
            const match = hash.match(/klee=([^&]+)/);
            if (match && match[1]) {
                const decoded = decodeBlueprintFromHash(match[1]);
                if (decoded) return decoded;
            }
        } catch (e) {
            console.warn("Failed to decode shared blueprint from URL", e);
        }
        return fallback;
    }

    private async maybeLoadCompressedShareAsync() {
        try {
            const hash = window.location.hash || "";
            const match = hash.match(/klee=([^&]+)/);
            if (!match || !match[1]) return;
            if (!match[1].startsWith("c.")) return;

            const decoded = await decodeBlueprintFromHashAsync(match[1]);
            if (decoded) {
                this.loadBlueprintIntoScene(decoded);
            }
        } catch (e) {
            console.warn("Failed to decode compressed shared blueprint", e);
        }
    }

    public refresh() {
        const pixelRatio = window.devicePixelRatio || 1;
        this._canvas.pixelRatio = pixelRatio;
        this._element.width = this._element.offsetWidth * pixelRatio;
        this._element.height = this._element.offsetHeight * pixelRatio;

        this._scene.collectInteractables();
        this._scene.updateLayout();
        this._scene.refresh();

        if (this._overlay) {
            this._overlay.onSceneRefreshed();
        }
    }

    public get element(): HTMLCanvasElement {
        return this._element;
    }

    public get embedMode(): boolean {
        return this._embedMode;
    }

    public notifyCameraChanged() {
        if (this._overlay) {
            this._overlay.onCameraChanged();
        }
    }

    public zoomInAtCenter() {
        const center = new Vector2(this._canvas.width / 2, this._canvas.height / 2);
        this._scene.camera.zoomAt(center, 1.2);
        this.refresh();
    }

    public zoomOutAtCenter() {
        const center = new Vector2(this._canvas.width / 2, this._canvas.height / 2);
        this._scene.camera.zoomAt(center, 1 / 1.2);
        this.refresh();
    }

    public resetZoom() {
        this._scene.camera.resetZoom();
        this.recenterCamera();
    }

    public fitToView() {
        const nodes = this._scene.nodes;
        if (nodes.length === 0) return;

        let xMin = Number.MAX_SAFE_INTEGER;
        let xMax = Number.MIN_SAFE_INTEGER;
        let yMin = Number.MAX_SAFE_INTEGER;
        let yMax = Number.MIN_SAFE_INTEGER;

        nodes.forEach(node => {
            xMin = Math.min(node.position.x, xMin);
            yMin = Math.min(node.position.y, yMin);
            xMax = Math.max(node.position.x + node.size.x, xMax);
            yMax = Math.max(node.position.y + node.size.y, yMax);
        });

        const padding = 80;
        const contentWidth = xMax - xMin + padding * 2;
        const contentHeight = yMax - yMin + padding * 2;
        const scaleX = this._canvas.width / contentWidth;
        const scaleY = this._canvas.height / contentHeight;

        this._scene.camera.scale = Math.min(scaleX, scaleY, 1);
        this.recenterCamera();
    }

    public focusOnNode(nodeIndex: number) {
        const nodes = this._scene.nodes;
        if (nodeIndex < 0 || nodeIndex >= nodes.length) return;
        const node = nodes[nodeIndex];

        this._scene.selectOnly(node);

        const scale = this._scene.camera.scale;
        const cx = -(node.position.x + node.size.x / 2);
        const cy = -(node.position.y + node.size.y / 2);
        this._scene.camera.centerAbsolutePosition(new Vector2(cx, cy));
        this.refresh();
    }

    public selectAllNodes() {
        this._scene.selectAllNodes();
        this._scene.refresh();
    }

    public getPreviewState(): KleePreviewChangeDetail {
        const rootNodeName = this._inspection?.rootNodeName;
        const target = this._previewNodeName
            ? this._scene.nodes.find(node => node.name === this._previewNodeName)
            : this._scene.nodes.find(node => node.name === rootNodeName);
        const active = Boolean(this._previewNodeName && target);
        return {
            active,
            isPreviewing: active,
            nodeName: target?.name,
            title: target?.title,
            rootNodeName,
            pixelRenderingAvailable: false,
            diagnostics: this._inspection ? [
                ...this._inspection.diagnostics.map(diagnostic => ({ ...diagnostic })),
                ...this._inspection.preview.diagnostics.map(diagnostic => ({ ...diagnostic })),
            ] : [],
        };
    }

    public togglePreviewSelected(): KleePreviewChangeDetail {
        if (!this._inspection?.preview.targetSelectionAvailable) {
            return this.dispatchPreviewChange("unsupported-graph");
        }

        const selectedNodes = this._scene.selectedNodes;
        if (selectedNodes.length > 1) {
            return this.dispatchPreviewChange("multiple-selection");
        }
        if (selectedNodes.length === 0) {
            if (this._previewNodeName) return this.clearPreview("no-selection");
            return this.dispatchPreviewChange("no-selection");
        }
        const selected = this._scene.primarySelectedNode || selectedNodes[0];

        if (!isMaterialGraphNodeClass(selected.nodeClass)) {
            return this.dispatchPreviewChange("unsupported-node");
        }

        if (selected.name === this._inspection.rootNodeName) {
            return this.clearPreview("root-selected");
        }
        if (selected.name === this._previewNodeName) {
            return this.clearPreview("toggled-off");
        }

        this._previewNodeName = selected.name;
        this.applyPreviewStyling();
        this._scene.refresh();
        return this.dispatchPreviewChange("preview-selected");
    }

    public clearPreview(reason: KleePreviewChangeDetail["reason"] = "cleared"): KleePreviewChangeDetail {
        this._previewNodeName = undefined;
        this.applyPreviewStyling();
        this._scene.refresh();
        return this.dispatchPreviewChange(reason);
    }

    private applyPreviewStyling(): void {
        const targetName = this._previewNodeName || this._inspection?.rootNodeName;
        this._scene.nodes.forEach(node => node.previewed = Boolean(targetName && node.name === targetName));
    }

    private dispatchPreviewChange(reason?: KleePreviewChangeDetail["reason"]): KleePreviewChangeDetail {
        const detail = { ...this.getPreviewState(), reason };
        this._element.dispatchEvent(new CustomEvent<KleePreviewChangeDetail>(KLEE_PREVIEW_CHANGE_EVENT, {
            bubbles: true,
            detail,
        }));
        return detail;
    }

    public async copyAllToClipboard(): Promise<void> {
        const text = this.getBlueprint();
        try {
            await navigator.clipboard.writeText(text);
        } catch (e) {
            console.warn("Could not write blueprint to clipboard", e);
        }
    }

    public get animationTime(): number {
        return this._animationTime;
    }

    public get animationEnabled(): boolean {
        return this._animationEnabled && this._scene.hasExecConnections;
    }

    public setAnimationEnabled(enabled: boolean) {
        this._animationEnabled = enabled;
        if (!enabled) {
            this._scene.refresh();
        }
    }

    private startAnimationLoop() {
        this._animationStartedAt = performance.now();
        const tick = (now: number) => {
            this._animationTime = now - this._animationStartedAt;
            if (!document.hidden && this.animationEnabled) {
                // Redraw only; skip layout reflow and overlay updates.
                this._scene.refresh();
            }
            this._animationRafId = requestAnimationFrame(tick);
        };
        this._animationRafId = requestAnimationFrame(tick);
    }

    public async exportPNG(filename: string = "blueprint.png"): Promise<void> {
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
        const blob = await new Promise<Blob | null>(resolve => {
            this._element.toBlob(b => resolve(b), "image/png");
        });
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 2000);
    }

    public async copyShareLink(): Promise<string> {
        const text = this.getBlueprint();
        const hash = await encodeBlueprintToHash(text);
        const url = `${location.origin}${location.pathname}${location.search}#klee=${hash}`;
        try {
            await navigator.clipboard.writeText(url);
        } catch (e) {
            console.warn("Could not write share link to clipboard", e);
        }
        return url;
    }

    private copyBlueprintSelectionToClipboard() {
        console.log("Copy selection");

        let textLines = [];
        this._scene.nodes.filter(n => n.selected).forEach(n => textLines = [].concat(textLines, n.sourceText));
        navigator.clipboard.writeText(textLines.join('\n'));

        return true;
    }

    private pasteClipboardContentToCanvas(ev) {
        if (!this.allowPaste) return;
        if (Application.isFirefox) {
            return false;
        }

        console.log("Paste from clipboard");

        navigator.clipboard.readText().then((text) => {
            if(!text) return;
            this.loadBlueprintIntoScene(text);
        });

        return true;
    }

    private onPaste(ev) {
        if (!this.allowPaste) return;
        console.log("Paste from clipboard");
        let text = ev.clipboardData.getData("text/plain");
        this.loadBlueprintIntoScene(text);
    }

    public loadBlueprintIntoScene(text: string, options: KleeDisplayOptions = {}): KleeGraphInspection {
        this._scene.unload();
        this._inspection = inspectUnrealGraph(text, options.graph);
        const nodes = this._parser.parseBlueprint(text, this._inspection);
        this._scene.load(nodes);
        this._previewNodeName = undefined;
        this.applyPreviewStyling();
        this.refresh();

        this.recenterCamera();
        this.dispatchPreviewChange();
        return this._inspection;
    }

    recenterCamera() {
        // Move camera to the center of all nodes
        this._scene.camera.centerAbsolutePosition(this._scene.calculateCenterPoint());
        this.refresh();
        return true;
    }

    static registerInstance(element: HTMLCanvasElement, app: Application) {
        element.setAttribute("data-klee-instance", Application.instances.length.toString());
        Application.instances.push(app);
    }

    public static getInstance(element: HTMLCanvasElement): Application {
        let instanceAttr = element.getAttributeNode("data-klee-instance");
        if (instanceAttr) {
            let id = Number.parseInt(instanceAttr.value);
            if (!isNaN(id) && id < Application.instances.length) {
                let instance = Application.instances[id];
                return instance;
            }
        }

        return undefined;
    }

    public static createOrGet(element: HTMLCanvasElement): Application {
        let instance = this.getInstance(element);
        if (instance !== undefined) {
            return instance;
        }

        let app = new Application(element)
        Application.registerInstance(element, app);

        return app;
    }
}
