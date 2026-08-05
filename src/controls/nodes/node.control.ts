import { Canvas2D } from "../../canvas";
import { Constants } from "../../constants";
import { Vector2 } from "../../math/vector2";
import { Node } from "../../data/nodes/node";
import { PinControl } from "../pin.control";
import { HorizontalAlignment, VerticalPanel } from "../vertical-panel";
import { HorizontalPanel } from "../horizontal-panel";
import { PinProperty } from "../../data/pin/pin-property";
import { PinDirection } from "../../data/pin/pin-direction";
import { Container } from "../container";
import { ErrorBar } from "../error-bar";
import { NodeInfoIcon } from "../node-info-icon";
import { IconLibrary } from "../utils/icon-library";
import { KleeNodeActivateDetail } from "../../events";


export abstract class NodeControl extends Container {

    // UE5 graph editor defaults: amber selection wrap, and the previewed-node
    // border from FColor(70,100,200).
    private static readonly _SELECTION_COLOR = 'rgb(243,176,74)';
    private static readonly _SELECTION_LINE_WIDTH = 2.5;
    private static readonly _PREVIEW_COLOR = 'rgb(70,100,200)';
    private static readonly _PREVIEW_LINE_WIDTH = 3;

    private _node: Node;
    protected pins: Array<PinControl> = [];

    protected mainPanel: VerticalPanel;
    protected pinPanel: HorizontalPanel;
    protected inputPinPanel: VerticalPanel;
    protected outputPinPanel: VerticalPanel;

    public showAdvanced: boolean;


    private _selected: boolean;
    private _previewed: boolean;
    /** Where the pasted graph placed this node. Dragging never overwrites it. */
    private readonly _authoredPosition: Vector2;
    protected _stroke: {
        lineWidth: number,
        style: string
    }

    constructor(node: Node) {
        super(node.pos.x, node.pos.y);
        this._node = node;
        this.width = 0;
        this.height = 0;

        this._selected = false;
        this._previewed = false;
        this._authoredPosition = new Vector2(node.pos.x, node.pos.y);
        this._stroke = {
            lineWidth: 1,
            style: Constants.NODE_BORDER_COLOR
        }

        this.showAdvanced = node.advancedPinDisplay;

        this.mainPanel = new VerticalPanel();
        this.mainPanel.fillParentHorizontal = true;
        this.add(this.mainPanel);
        
        this.pinPanel = new HorizontalPanel();
        this.pinPanel.fillParentHorizontal = true;

        this.mainPanel.add(this.pinPanel);

        this.inputPinPanel = new VerticalPanel();
        this.outputPinPanel = new VerticalPanel();
        this.outputPinPanel.childAlignment = HorizontalAlignment.RIGHT;
        this.outputPinPanel.fillParentHorizontal = true;
        
        this.pinPanel.add(this.inputPinPanel);
        this.pinPanel.add(this.outputPinPanel);
        
        this.initErrorBar();
        this.addInfoIcons();

    }

    private initErrorBar() {
        if (this.node.errorType !== undefined && this.node.errorMsg !== undefined) {
            switch (this.node.errorType) {
                case 1: 
                    let errorBar = new ErrorBar("ERROR!", this.node.errorMsg);
                    this.mainPanel.add(errorBar);
                    break;
            }
        }
    }

    private addInfoIcons() {
        if (this.node.latent) {
            this.mainPanel.add(new NodeInfoIcon(IconLibrary.LATENT));
        }
    }

    public set selected(isSelected: boolean) {
        this._selected = isSelected;
    }

    public get selected(): boolean {
        return this._selected;
    }

    public set previewed(isPreviewed: boolean) {
        this._previewed = isPreviewed;
    }

    public get previewed(): boolean {
        return this._previewed;
    }

    /** True once the node sits anywhere other than its authored position. */
    public get moved(): boolean {
        return this.position.x !== this._authoredPosition.x
            || this.position.y !== this._authoredPosition.y;
    }

    public moveBy(deltaX: number, deltaY: number): void {
        this.position = new Vector2(this.position.x + deltaX, this.position.y + deltaY);
    }

    public moveTo(x: number, y: number): void {
        this.position = new Vector2(x, y);
    }

    public get authoredPosition(): Vector2 {
        return new Vector2(this._authoredPosition.x, this._authoredPosition.y);
    }

    public resetPosition(): void {
        this.position = new Vector2(this._authoredPosition.x, this._authoredPosition.y);
    }

    public get nodeClass(): string {
        return this._node.class;
    }

    public get title(): string {
        return this._node.title || "";
    }

    public get sourceText(): string {
        return this._node.sourceText;
    }

    public get name(): string {
        return this._node.name;
    }

    public get searchableText(): string {
        const title = this._node.title || "";
        const subtitles = (this._node.subTitles || []).map(s => s.text).join(" ");
        return `${title} ${subtitles}`.trim();
    }

    /** Returns a fresh, serializable snapshot; callers never receive the internal node object. */
    public get activationDetail(): KleeNodeActivateDetail {
        const detail: KleeNodeActivateDetail = {
            nodeName: this._node.name,
            nodeClass: this._node.class,
            title: this._node.title || "",
        };

        if (this._node.materialExpressionClass) {
            detail.expressionClass = this._node.materialExpressionClass;
        }

        if (this._node.materialFunction) {
            detail.assetName = this._node.materialFunction.assetName;
            detail.objectPath = this._node.materialFunction.objectPath;
        }

        if (this._node.references && this._node.references.length > 0) {
            detail.references = this._node.references.map(reference => ({ ...reference }));
            detail.reference = { ...detail.references[0] };
        }

        return detail;
    }

    protected get node(): Node {
        return this._node;
    }

    protected createPins(offset?: Vector2): void {
        for (let property of this.node.customProperties) {
            if (property instanceof PinProperty) {
                this.createPin(property);
            }
        }
    }

    protected createPin(property: PinProperty) {
        let pinControl = new PinControl(this.position, property);
        this.pins.push(pinControl);
        this.onPinCreated(pinControl);
    }

    protected onPinCreated(pin: PinControl) {
        if (pin.pinProperty.direction === PinDirection.EGPD_Output) {
            this.outputPinPanel.add(pin);
        } else {
            this.inputPinPanel.add(pin);
        }
    }

    protected onDraw(canvas: Canvas2D) {
/// #if DEBUG_UI
        canvas.strokeStyle("#e00");
        canvas.strokeRect(0, 0, this.size.x, this.size.y);
/// #endif
    }

    protected drawStroke(canvas: Canvas2D) {
        if(this._previewed) {
            canvas.lineWidth(NodeControl._PREVIEW_LINE_WIDTH).strokeStyle(NodeControl._PREVIEW_COLOR);
        } else if(this._selected) {
            canvas.lineWidth(NodeControl._SELECTION_LINE_WIDTH).strokeStyle(NodeControl._SELECTION_COLOR);
        } else {
            canvas.lineWidth(this._stroke.lineWidth).strokeStyle(this._stroke.style);
        }
        canvas.stroke();
    }
}
