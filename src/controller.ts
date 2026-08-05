import { Application } from "./application";
import { NodeControl } from "./controls/nodes/node.control";
import { BoundingBox } from "./math/boundingbox";
import { Vector2 } from "./math/vector2";
import { InteractableControl, isInteractableControl } from "./controls/interfaces/interactable";
import { Control } from "./controls/control";
import { UserControl } from "./controls/user-control";
import { InteractableUserControl } from "./controls/interactable-user-control";
import { Scene } from "./scene";
import { KLEE_NODE_ACTIVATE_EVENT, KleeNodeActivateDetail } from "./events";

export interface KeyAction {
    keycode: string
    ctrl: boolean;
    callback: (ev: KeyboardEvent) => boolean
}

enum MouseButton {
    Left,
    Middle,
    Right
}

export class Controller {

    private _actions: KeyAction[] = [];

    private _mouseDownData: {
        buttonType: MouseButton,
        position: Vector2
    }
    private _mousePositionOfPreviousMove: Vector2;
    private _element: HTMLCanvasElement;
    private app: Application;

    private hoveredControls: InteractableUserControl[] = [];
    private readonly _listeners = new AbortController();
    /** Set when a left press lands on a node, so the drag moves rather than marquees. */
    private _dragData: { origins: Array<{ node: NodeControl, x: number, y: number }> } | null = null;
    private static readonly GRID_SNAP = 16;

    constructor(element: HTMLCanvasElement, app: Application) {

        this.app = app;

        this._element = element;
        if (Application.isFirefox) {
            this._element.setAttribute("contenteditable", ""); // allow pasting to the canvas
            this._element.style.cursor = "default";
            this._element.style.color = "transparent"; // Hide caret
        }

        // A tabindex higher than -1 is needed so that html element reseaves focus events
        // which is required that the key events get fired.
        element.tabIndex = 0;

        element.onmousedown = (ev) => this.onMouseDown(ev);
        element.onmouseup = (ev) => this.onMouseUp(ev);
        element.onmousemove = (ev) => this.onMouseMove(ev);
        element.onmouseenter = (ev) => this.onMouseEnter(ev);
        element.onmouseleave = (ev) => this.onMouseLeave(ev);
        element.onkeydown = (ev) => this.onKeydown(ev);
        element.oncontextmenu = (ev) => this.onContextMenu(ev);
        element.addEventListener('wheel', (ev) => this.onWheel(ev), { passive: false, signal: this._listeners.signal });
        element.addEventListener('dblclick', (ev) => this.onDoubleClick(ev), { signal: this._listeners.signal });

        this.registerAction({
            ctrl: true,
            keycode: 'KeyA',
            callback: this.selectAllNodes.bind(this),
        });
    }

    registerAction(action: KeyAction) {
        this._actions.push(action);
    }

    /** Detaches every input listener this controller installed on the canvas. */
    public destroy() {
        this._listeners.abort();
        this._element.onmousedown = null;
        this._element.onmouseup = null;
        this._element.onmousemove = null;
        this._element.onmouseenter = null;
        this._element.onmouseleave = null;
        this._element.onkeydown = null;
        this._element.oncontextmenu = null;
        this._actions = [];
        this.hoveredControls = [];
        this._mouseDownData = null;
        this._dragData = null;
    }

    onKeydown(ev : KeyboardEvent) {
        for (const action of this._actions.filter(a => a.keycode === ev.code)) {
            if(action.ctrl !== ev.ctrlKey) continue;

            if (action.callback(ev)) {
                ev.preventDefault();
            }
        }
    }

    onMouseDown(ev: MouseEvent) {
        this._mouseDownData = {
            buttonType: ev.button,
            position: this.getMousePosition(ev)
        }
        this._mousePositionOfPreviousMove = this._mouseDownData.position;

        const mouseAbsolutePos = this.getAbsoluteMousePosition(ev);

        if (ev.button === MouseButton.Left) {
            const pressed = this.getIntersectingNodeControls(mouseAbsolutePos, new Vector2(0, 0))
                .sort((a, b) => b.ZIndex - a.ZIndex)[0];
            if (pressed) {
                // Pressing an unselected node selects it first, so a drag always
                // moves what is under the cursor rather than a stale selection.
                if (!pressed.selected) this.app.scene.selectOnly(pressed);
                const moving = this.app.scene.selectedNodes;
                this._dragData = {
                    origins: moving.map(node => ({ node, x: node.position.x, y: node.position.y })),
                };
            }
        }

        let controls = this.getIntersectingControls(mouseAbsolutePos, new Vector2(0, 0));
        controls = controls.sort((c1, c2) => { return c1.ZIndex - c2.ZIndex; })
        for (let control of controls) {
            if (control.onMouseDown(ev))
                break;
        }

        for (let control of this.hoveredControls) {
            if (controls.indexOf(control) < 0) {
                this.hoveredControls.splice(this.hoveredControls.indexOf(control), 1);
                if (isInteractableControl(control)) {
                    control.onMouseLeave(ev);
                }
            }
        }
        
        //Application.scene.refresh();
    }

    onMouseUp(ev: MouseEvent) {
        const currentMousePosition = this.getMousePosition(ev);
        const mouseAbsolutePos = this.getAbsoluteMousePosition(ev);



        let consumed = false;

        let controls = this.getIntersectingControls(mouseAbsolutePos, new Vector2(0, 0));
        controls = controls.sort((c1, c2) => { return c1.ZIndex - c2.ZIndex; })
        for (let control of controls) {
            if (isInteractableControl(control)) {
                if (consumed = control.onMouseUp(ev))
                    break;
            }
        }

        for (let control of this.hoveredControls) {
            if (controls.indexOf(control) < 0) {
                this.hoveredControls.splice(this.hoveredControls.indexOf(control), 1);
                if (isInteractableControl(control)) {
                    control.onMouseLeave(ev);
                }
            }
        }

        if (this._mouseDownData && !consumed) {
            const delta = currentMousePosition.subtract(this._mouseDownData.position);
    
            if (delta.x == 0 && delta.y == 0 && !this._dragData) {
                this.selectIntersectingControls(mouseAbsolutePos, new Vector2(0,0));
            }
        }

        this._dragData = null;
        this._mouseDownData = null;
        this.app.refresh();
    }

    onMouseMove(ev: MouseEvent) {
        const currentMousePosition = this.getMousePosition(ev);
        const mouseAbsolutePos = this.getAbsoluteMousePosition(ev);

        if (this._mouseDownData) {
            if (this._mouseDownData.buttonType === MouseButton.Right) {
                const delta = currentMousePosition.subtract(this._mousePositionOfPreviousMove);
                this._mousePositionOfPreviousMove = currentMousePosition;

                this.app.scene.camera.moveRelative(delta);
                this.app.scene.refresh();
                return false;
            }

            if(this._mouseDownData.buttonType === MouseButton.Left) {
                const scale = this.app.scene.camera.scale;
                const deltaScreen = currentMousePosition.subtract(this._mouseDownData.position);
                const deltaWorld = new Vector2(deltaScreen.x / scale, deltaScreen.y / scale);

                if (this._dragData) {
                    // Unreal snaps dragged nodes to the 16px minor grid.
                    const snap = Controller.GRID_SNAP;
                    for (const origin of this._dragData.origins) {
                        origin.node.moveTo(
                            Math.round((origin.x + deltaWorld.x) / snap) * snap,
                            Math.round((origin.y + deltaWorld.y) / snap) * snap
                        );
                    }
                    this.app.notifyNodesMoved();
                    this.app.refresh();
                    return false;
                }

                this.app.scene.refresh();

                const mouseDownAbsolutePos = this.getAbsoluteMouseDownPosition(ev);
                this.drawMouseSelection(mouseDownAbsolutePos.x, mouseDownAbsolutePos.y, deltaWorld.x, deltaWorld.y);
                this.selectIntersectingControls(mouseDownAbsolutePos, deltaWorld);
                return false;
            }
        }

        let controls = this.getIntersectingControls(mouseAbsolutePos, new Vector2(0, 0));
        
        for (let control of controls) {
            if (this.hoveredControls.indexOf(control) < 0) {
                this.hoveredControls.push(control);
                if (isInteractableControl(control)) {
                    control.onMouseEnter(ev);
                }
            }
        }

        controls = controls.sort((c1, c2) => { return c1.ZIndex - c2.ZIndex; })
        for (let control of controls) {
            if (isInteractableControl(control)) {
                if (control.onMouseMove(ev))
                    break;
            }
        }

        for (let control of this.hoveredControls) {
            if (controls.indexOf(control) < 0) {
                this.hoveredControls.splice(this.hoveredControls.indexOf(control), 1);
                if (isInteractableControl(control)) {
                    control.onMouseLeave(ev);
                }
            }
        }

        return false;
    }

    onMouseEnter(ev: MouseEvent) {
        if (ev.buttons == 0) {
            this._mouseDownData = null;
        }
    }

    onMouseLeave(ev: MouseEvent) {
        if(this._mouseDownData) {
            if(this._mouseDownData.buttonType === MouseButton.Left) {

                this.app.scene.clearSelection();
                this.app.scene.refresh();
                return false;
            }
        }
     }

    onDoubleClick(ev: MouseEvent) {
        if (ev.button !== MouseButton.Left) return;

        const mouseAbsolutePos = this.getAbsoluteMousePosition(ev);
        const sceneNodes = this.app.scene.nodes;
        const nodes = this.getIntersectingNodeControls(mouseAbsolutePos, new Vector2(0, 0))
            .sort((a, b) => {
                const zIndexDifference = b.ZIndex - a.ZIndex;
                return zIndexDifference || sceneNodes.indexOf(b) - sceneNodes.indexOf(a);
            });
        const node = nodes[0];
        if (!node) return;

        this.app.scene.selectOnly(node);
        this.app.refresh();

        const detail: KleeNodeActivateDetail = node.activationDetail;
        this._element.dispatchEvent(new CustomEvent<KleeNodeActivateDetail>(KLEE_NODE_ACTIVATE_EVENT, {
            bubbles: true,
            cancelable: true,
            detail,
        }));
    }

    onContextMenu(ev: MouseEvent) {
        ev.preventDefault();
        ev.stopPropagation();
        return false;
    }

    onWheel(ev: WheelEvent) {
        ev.preventDefault();
        const mousePos = this.getMousePosition(ev);
        const factor = ev.deltaY < 0 ? 1.1 : 1 / 1.1;
        this.app.scene.camera.zoomAt(mousePos, factor);
        this.app.scene.refresh();
        this.app.notifyCameraChanged();
    }

    drawMouseSelection(x: number, y: number, sizeX: number, sizeY: number) {
        this.app.canvas
            .save()
            .setLineDash([6])
            .strokeStyle('#fff')
            .lineWidth(2)
            .strokeRect(x, y, sizeX, sizeY)
            .restore();
    }

    selectIntersectingControls(pos: Vector2, size: Vector2): void {
        const intersectingControls = this.getIntersectingNodeControls(pos, size);
        let primary: NodeControl | undefined;
        if (size.x === 0 && size.y === 0 && intersectingControls.length > 0) {
            const sceneNodes = this.app.scene.nodes;
            primary = [...intersectingControls].sort((a, b) => {
                const zIndexDifference = b.ZIndex - a.ZIndex;
                return zIndexDifference || sceneNodes.indexOf(b) - sceneNodes.indexOf(a);
            })[0];
        }
        if (primary) {
            this.app.scene.selectOnly(primary);
        } else {
            this.app.scene.selectNodes(intersectingControls);
        }
    }

    getIntersectingNodeControls(pos: Vector2, size: Vector2): NodeControl[] {
        return this.app.scene.nodes.filter(n => BoundingBox.checkIntersection(pos, size, n.position, n.size)) || [];
    }

    getIntersectingControls(pos: Vector2, size: Vector2): InteractableUserControl[] {
        return this.app.scene.interactables.filter(n => BoundingBox.checkIntersection(pos, size, n.getAbsolutPosition(), n.size)) || [];
    }

    getAbsoluteMousePosition(ev: MouseEvent) {
        const cameraPos = this.app.scene.camera.position;
        const scale = this.app.scene.camera.scale;
        const currentMousePosition = this.getMousePosition(ev);
        return new Vector2(
            (currentMousePosition.x - cameraPos.x) / scale,
            (currentMousePosition.y - cameraPos.y) / scale);
    }

    getAbsoluteMouseDownPosition(ev: MouseEvent) {
        const cameraPos = this.app.scene.camera.position;
        const scale = this.app.scene.camera.scale;
        return new Vector2(
            (this._mouseDownData.position.x - cameraPos.x) / scale,
            (this._mouseDownData.position.y - cameraPos.y) / scale);
    }

    selectAllNodes() {
        this.app.scene.selectAllNodes();
        this.app.scene.refresh();
        return true;
    }

    getMousePosition(ev: MouseEvent): Vector2 {
        let rect = this._element.getBoundingClientRect();
        return new Vector2(ev.clientX - rect.left, ev.clientY - rect.top);
    }
}

function InteractableControl() {
    throw new Error("Function not implemented.");
}
