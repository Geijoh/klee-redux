const test = require("node:test");
const assert = require("node:assert/strict");

const { installBrowserGlobals } = require("./browser-globals");

const MATERIAL_GRAPH = [
    'Begin Object Class=/Script/UnrealEd.MaterialGraphNode_Root Name="MaterialGraphNode_Root_0"',
    'Material=PreviewMaterial\'"/Engine/Transient.M_Sample"\'',
    'CustomProperties Pin (PinId=ROOT1,PinName="Final Color",Direction="EGPD_Input",PinType.PinCategory="materialinput",)',
    'End Object',
    'Begin Object Class=/Script/UnrealEd.MaterialGraphNode Name="MaterialGraphNode_0"',
    'Begin Object Class=/Script/Engine.MaterialExpressionMultiply Name="MaterialExpressionMultiply_0"',
    'End Object',
    'NodePosX=-300',
    'NodePosY=0',
    'CustomProperties Pin (PinId=OUT1,PinName="Result",Direction="EGPD_Output",PinType.PinCategory="float",)',
    'End Object',
].join('\n');

test("destroy releases the frame loop, listeners and registry slot", () => {
    const makeElement = installBrowserGlobals();
    const Klee = require("../dist/klee.min.js");

    const canvas = makeElement("canvas");
    makeElement("div").appendChild(canvas);

    const windowListenersBefore = window.totalListenerCount();
    const documentListenersBefore = document.totalListenerCount();

    const viewer = Klee.init(canvas);
    viewer.display(MATERIAL_GRAPH);

    assert.ok(window.totalListenerCount() > windowListenersBefore, "expected window listeners while mounted");
    assert.ok(document.totalListenerCount() > documentListenersBefore, "expected document listeners while mounted");
    assert.ok(canvas.totalListenerCount() > 0, "expected canvas listeners while mounted");
    assert.ok(pendingAnimationFrames.size > 0, "expected a scheduled animation frame while mounted");
    assert.equal(canvas.getAttribute("data-klee-instance"), "0");
    assert.equal(viewer.app.scene.nodes.length, 2);

    viewer.destroy();

    assert.equal(window.totalListenerCount(), windowListenersBefore, "window listeners must be detached");
    assert.equal(document.totalListenerCount(), documentListenersBefore, "document listeners must be detached");
    assert.equal(canvas.totalListenerCount(), 0, "canvas listeners must be detached");
    assert.equal(pendingAnimationFrames.size, 0, "the animation frame loop must be cancelled");
    assert.equal(canvas.getAttribute("data-klee-instance"), null, "the registry slot must be released");
    assert.equal(canvas.onkeydown, null);
    assert.equal(canvas.onpaste, null);
    assert.equal(viewer.app.scene.nodes.length, 0, "the scene must be unloaded");
});

test("destroy is idempotent and lets the same canvas be re-initialized", () => {
    const makeElement = installBrowserGlobals();
    const Klee = require("../dist/klee.min.js");

    const canvas = makeElement("canvas");
    makeElement("div").appendChild(canvas);

    const viewer = Klee.init(canvas);
    viewer.display(MATERIAL_GRAPH);
    viewer.destroy();
    viewer.destroy();

    assert.equal(Klee.get(canvas), undefined, "a destroyed instance must not be handed back out");

    const revived = Klee.init(canvas);
    const inspection = revived.display(MATERIAL_GRAPH);

    assert.equal(inspection.kind, "material");
    assert.equal(revived.app.scene.nodes.length, 2);
    assert.ok(pendingAnimationFrames.size > 0, "the new instance must run its own frame loop");

    revived.destroy();
    assert.equal(pendingAnimationFrames.size, 0);
});

test("the overlay returns the canvas to its original parent on destroy", () => {
    const makeElement = installBrowserGlobals();
    const Klee = require("../dist/klee.min.js");

    const host = makeElement("div");
    const canvas = makeElement("canvas");
    host.appendChild(canvas);

    const viewer = Klee.init(canvas);
    assert.notEqual(canvas.parentElement, host, "the overlay is expected to wrap the canvas");
    assert.equal(host.children.length, 1);

    viewer.destroy();

    assert.equal(canvas.parentElement, host, "the canvas must be returned to its original parent");
    assert.equal(host.children.length, 1, "the overlay wrapper must be removed");
    assert.equal(host.children[0], canvas);
});

test("a second Material root is reported instead of silently replacing the first", () => {
    const makeElement = installBrowserGlobals();
    const Klee = require("../dist/klee.min.js");

    const viewer = Klee.init(makeElement("canvas"));
    const inspection = viewer.display([
        MATERIAL_GRAPH,
        'Begin Object Class=/Script/UnrealEd.MaterialGraphNode_Root Name="MaterialGraphNode_Root_1"',
        'CustomProperties Pin (PinId=ROOT2,PinName="Opacity",Direction="EGPD_Input",PinType.PinCategory="materialinput",)',
        'End Object',
    ].join('\n'));

    assert.equal(inspection.rootNodeName, "MaterialGraphNode_Root_0");
    assert.deepEqual(inspection.material.serializedRootInputs, ["Final Color"]);

    const diagnostic = inspection.diagnostics.find(entry => entry.code === "material-multiple-roots");
    assert.ok(diagnostic, "expected a material-multiple-roots diagnostic");
    assert.equal(diagnostic.severity, "warning");
    assert.equal(diagnostic.nodeName, "MaterialGraphNode_Root_1");

    viewer.destroy();
});

const UI_ROOT = blendMode => [
    'Begin Object Class=/Script/UnrealEd.MaterialGraphNode_Root Name="MaterialGraphNode_Root_0"',
    'CustomProperties Pin (PinId=R1,PinName="Final Color",PinType.PinCategory="materialinput",)',
    'CustomProperties Pin (PinId=R2,PinName="Opacity",PinType.PinCategory="materialinput",)',
    'CustomProperties Pin (PinId=R3,PinName="Opacity Mask",PinType.PinCategory="materialinput",)',
    'CustomProperties Pin (PinId=R4,PinName="Screen Position",PinType.PinCategory="materialinput",)',
    'CustomProperties Pin (PinId=R5,PinName="Front Material",PinType.PinCategory="materialinput",)',
    'End Object',
].join('\n');

test("UI root inputs gray out per blend mode, matching the editor", () => {
    const makeElement = installBrowserGlobals();
    const Klee = require("../dist/klee.min.js");

    // Every state below is taken from the UE5 UI-domain result node: the pins
    // are always present, and only which ones are usable changes.
    const cases = [
        { blendMode: "BLEND_Opaque", inactive: ["Opacity", "Opacity Mask"] },
        { blendMode: "BLEND_ColorTransmittanceOnly", inactive: ["Opacity", "Opacity Mask"] },
        { blendMode: "BLEND_Masked", inactive: ["Opacity"] },
        { blendMode: "BLEND_Translucent", inactive: ["Opacity Mask"] },
        { blendMode: "BLEND_Additive", inactive: ["Opacity Mask"] },
        { blendMode: "BLEND_AlphaComposite", inactive: ["Opacity Mask"] },
    ];

    for (const { blendMode, inactive } of cases) {
        const viewer = Klee.init(makeElement("canvas"));
        viewer.display(UI_ROOT(blendMode), {
            graph: { material: { domain: "MD_UI", blendMode, unrealVersion: "5.7" } },
        });
        const root = viewer.app.scene.nodes[0];

        assert.deepEqual(
            root.pins.filter(pin => pin.visible).map(pin => pin.pinProperty.name),
            ["Final Color", "Opacity", "Opacity Mask", "Screen Position", "Front Material"],
            `${blendMode}: every serialized root pin must stay rendered`
        );
        assert.deepEqual(
            root.pins.filter(pin => pin.pinProperty.inactive).map(pin => pin.pinProperty.name),
            inactive,
            `${blendMode}: wrong pins grayed out`
        );
        viewer.destroy();
    }
});
