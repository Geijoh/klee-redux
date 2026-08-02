import { Camera } from "./camera";
import { Canvas2D } from "./canvas";
import { Background } from "./controls/background";
import { Control } from "./controls/control";
import { DrawableControl, isDrawableControl } from "./controls/interfaces/drawable";
import { NodeConnectionControl } from "./controls/node-connection.control";
import { NodeControl } from "./controls/nodes/node.control";
import { Vector2 } from "./math/vector2";
import { PinDirection } from "./data/pin/pin-direction";
import { NodePartialConnectionControl } from "./controls/partial-node-connection.control";
import { PinControl } from "./controls/pin.control";
import { UserControl } from "./controls/user-control";
import { Container } from "./controls/container";
import { InteractableControl, isInteractableControl } from "./controls/interfaces/interactable";
import { InteractableUserControl } from "./controls/interactable-user-control";
import { Application } from "./application";

export class Scene {

    private _canvas: Canvas2D;
    private _camera: Camera;

    private _controls: Array<Control>;
    private _nodes: Array<NodeControl>;
    private _pins: Array<PinControl>;
    private _allPins: Array<PinControl>;
    private _interactables: Array<InteractableUserControl>;
    private _primarySelectedNode: NodeControl | null = null;
    private _focusedNodeNames: Set<string> | null = null;
    private _hasExecConnections: boolean = false;

    private app;

    constructor(canvas: Canvas2D, app: Application) {
        this.app = app;
        this._canvas = canvas;
        this._camera = new Camera(this._canvas);
        this._nodes = new Array<NodeControl>();
        this._controls = new Array<Control>();
        this._pins = new Array<PinControl>();
        this._allPins = new Array<PinControl>();
    }

    // TODO: Move this out
    get camera() {
        return this._camera;
    }

    get canvas() {
        return this._canvas;
    }

    get nodes() {
        return this._nodes || [];
    }

    get interactables() {
        return this._interactables || [];
    }

    get primarySelectedNode(): NodeControl | null {
        if (this._primarySelectedNode && this._primarySelectedNode.selected) {
            return this._primarySelectedNode;
        }
        return null;
    }

    get selectedNodes(): NodeControl[] {
        return this._nodes.filter(node => node.selected);
    }

    clearSelection(): void {
        this._nodes.forEach(node => node.selected = false);
        this._primarySelectedNode = null;
    }

    selectOnly(node: NodeControl): void {
        this.clearSelection();
        node.selected = true;
        this._primarySelectedNode = node;
    }

    selectNodes(nodes: NodeControl[], primary?: NodeControl): void {
        this.clearSelection();
        nodes.forEach(node => node.selected = true);
        this._primarySelectedNode = primary && primary.selected
            ? primary
            : (nodes.length === 1 ? nodes[0] : null);
    }

    selectAllNodes(): void {
        this._nodes.forEach(node => node.selected = true);
        this._primarySelectedNode = null;
    }

    collectInteractables() {
        let interactables: Array<InteractableUserControl> = [];
        this._controls.forEach((control) => {
            if (control instanceof InteractableUserControl) {
                interactables.push(control);
            }
            
            if (control instanceof Container) {
                this.findInteractablesIn(interactables, control);
            }
        });

        this._interactables = interactables;
    }

    private findInteractablesIn(interactables: Array<InteractableUserControl>, container: Container) {

        for (let child of container.getChildren()) {
            if (child instanceof InteractableUserControl) {
                interactables.push(child);
            }

            if (child instanceof Container) {
                this.findInteractablesIn(interactables, child);
            }
        }
    }

    updateLayout() {
        this._controls.forEach((control) => {
            if (control instanceof UserControl) {
                (control as UserControl).refreshLayout();
            }
        });
    }

    refresh() {
        this.updateFocusSet();
        this._canvas.clear();

        this._controls.sort((a, b) => {
            return a.ZIndex - b.ZIndex;
        });

        this._camera.prepareViewport();

        const ctx = this._canvas.getContext();
        const focus = this._focusedNodeNames;

        this._controls.forEach((control) => {
            if (!isDrawableControl(control)) return;

            let dimmed = false;
            if (focus) {
                if (control instanceof NodeControl) {
                    dimmed = !focus.has(control.name);
                } else if (control instanceof NodeConnectionControl) {
                    const a = control.startNodeName;
                    const b = control.endNodeName;
                    dimmed = !(a && b && focus.has(a) && focus.has(b));
                }
            }

            if (dimmed) {
                ctx.save();
                ctx.globalAlpha = 0.22;
                (control as DrawableControl).draw(this._canvas);
                ctx.restore();
            } else {
                (control as DrawableControl).draw(this._canvas);
            }
        });
    }

    get hasExecConnections(): boolean {
        return this._hasExecConnections;
    }

    private updateFocusSet() {
        const selected: string[] = [];
        for (const n of this._nodes) {
            if (n.selected) selected.push(n.name);
        }
        if (selected.length === 0) {
            this._focusedNodeNames = null;
            return;
        }
        const focus = new Set<string>(selected);
        const selectedSet = new Set<string>(selected);
        for (const control of this._controls) {
            if (!(control instanceof NodeConnectionControl)) continue;
            const a = control.startNodeName;
            const b = control.endNodeName;
            if (!a || !b) continue;
            if (selectedSet.has(a)) focus.add(b);
            if (selectedSet.has(b)) focus.add(a);
        }
        this._focusedNodeNames = focus;
    }

    unload() {
        this._pins = new Array<PinControl>();
        this._allPins = new Array<PinControl>();
        this._nodes = new Array<NodeControl>();
        this._controls = new Array<Control>();
        this._primarySelectedNode = null;
    }

    load(dataNodes: NodeControl[]) {
        this.createBackground();
        this.createControlNodes(dataNodes);
        // Creates connection lines between pins

        this.createConnectionLines();

        this._hasExecConnections = this._controls.some(
            c => c instanceof NodeConnectionControl && (c as NodeConnectionControl).execWire);

        this.initializeControls();
    }

    private createBackground() {
        let background = new Background(this.camera);
        this._controls.push(background);
    }

    private createControlNodes(controls: NodeControl[]) {
        for (const control of controls) {
            this._nodes.push(control);
            this._controls.push(control);

            this.collectPins(control);
        }
    }

    private collectPins(control: Control) {
        if (control instanceof Container) {
            for (let child of control.getChildren()) {
                if (child instanceof PinControl) {
                    this._allPins.push(child);
                    if (child.visible) this._pins.push(child);
                }
                if (child instanceof Container) {
                    this.collectPins(child);
                }
            }
        }
    }

    private createConnectionLines() {
        const connectedPins: string[] = [];
        const pins = this._pins;

        for (let i = pins.length - 1; i >= 0; --i) {
            let pin = pins[i];

            if (!pin.pinProperty.isLinked) {
                pins.splice(i, 1);
                continue;
            }

            if (pin.pinProperty.direction != PinDirection.EGPD_Output)
                continue;

            let wasConnected = false;
            for (let n = 0; n < pin.pinProperty.linkedTo.length; ++n) {
                let link = pin.pinProperty.linkedTo[n];
                let otherPin = pins.find(p => p.pinProperty.nodeName === link.nodeName && p.pinProperty.id === link.pinID);

                if (!otherPin)
                    continue;

                this._controls.push(new NodeConnectionControl(pin, otherPin));

                connectedPins.push(pin.pinProperty.getUniqueName());
                connectedPins.push(otherPin.pinProperty.getUniqueName());

                wasConnected = true;
            }

            if (wasConnected)
                pins.splice(i, 1);
        }

        // Go through pins which are connected to a missing node
        for (let i = pins.length - 1; i >= 0; --i) {
            let pin = pins[i];

            if (connectedPins.indexOf(pin.pinProperty.getUniqueName()) >= 0)
                continue;

            const hasMissingTarget = pin.pinProperty.linkedTo.some(link =>
                !this._allPins.some(candidate =>
                    candidate.pinProperty.nodeName === link.nodeName &&
                    candidate.pinProperty.id === link.pinID));
            if (pin.pinProperty.isLinked && hasMissingTarget) {
                let partialConnection = new NodePartialConnectionControl(pin);

                this._controls.push(partialConnection);
            }
        }
    }

    private initializeControls() {
        for (let control of this._controls) {
            this.initializeControl(control);
        }        
    }

    private initializeControl(control: Control) {
        control.initControl(this.app);

        if (control instanceof Container) {
            for (let child of control.getChildren()) {
                this.initializeControl(child);
            }
        }
    }

    calculateCentroid(): Vector2 {
        let centroid = new Vector2(0, 0);
 
        if (this.nodes.length == 0)
            return centroid;

        this.nodes.forEach(node => {
            centroid = new Vector2(
                centroid.x - node.position.x - (node.size.x * 0.5),
                centroid.y - node.position.y - (node.size.y * 0.5));
        });

        return new Vector2(centroid.x / this.nodes.length, centroid.y / this.nodes.length);
    }

    calculateCenterPoint() {
        if (this.nodes.length == 0)
            return new Vector2(0, 0);

        let xMin = Number.MAX_SAFE_INTEGER;
        let xMax = Number.MIN_SAFE_INTEGER;
        let yMin = Number.MAX_SAFE_INTEGER;
        let yMax = Number.MIN_SAFE_INTEGER;

        this.nodes.forEach(node => {
            xMin = Math.min(node.position.x, xMin);
            yMin = Math.min(node.position.y, yMin);
            xMax = Math.max(node.position.x + node.size.x, xMax);
            yMax = Math.max(node.position.y + node.size.y, yMax);
        });

        let width = xMax - xMin;
        let height = yMax - yMin;

        return new Vector2(-width * 0.5 -xMin , -height * 0.5 -yMin);
    }
}
