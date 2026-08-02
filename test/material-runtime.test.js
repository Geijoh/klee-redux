const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function installBrowserGlobals() {
    const makeClassList = () => ({
        add() {},
        remove() {},
        contains() { return false; },
        toggle() { return false; },
    });

    const context = new Proxy({
        measureText: value => ({
            width: String(value).length * 7,
            fontBoundingBoxAscent: 9,
            fontBoundingBoxDescent: 3,
        }),
        createLinearGradient: () => ({ addColorStop() {} }),
        createRadialGradient: () => ({ addColorStop() {} }),
    }, {
        get: (target, key) => key in target ? target[key] : () => {},
        set: (target, key, value) => (target[key] = value, true),
    });

    const makeElement = (tag = "div") => {
        const attributes = new Map();
        const listeners = new Map();

        return {
            tagName: tag.toUpperCase(),
            children: [],
            style: {},
            classList: makeClassList(),
            parentElement: null,
            innerHTML: "",
            textContent: "",
            className: "",
            tabIndex: 0,
            width: 1200,
            height: 800,
            offsetWidth: 1200,
            offsetHeight: 800,
            appendChild(child) {
                this.children.push(child);
                child.parentElement = this;
                return child;
            },
            addEventListener(type, listener) {
                const typeListeners = listeners.get(type) || [];
                typeListeners.push(listener);
                listeners.set(type, typeListeners);
            },
            removeEventListener() {},
            dispatchEvent(event) {
                for (const listener of listeners.get(event.type) || []) listener(event);
                return !event.defaultPrevented;
            },
            emit(type, event) {
                for (const listener of listeners.get(type) || []) listener(event);
            },
            focus() {},
            click() {},
            setAttribute(name, value) {
                attributes.set(name, String(value));
            },
            getAttribute: name => attributes.get(name) ?? null,
            getAttributeNode: name => attributes.has(name) ? { value: attributes.get(name) } : null,
            getBoundingClientRect() {
                return { left: 0, top: 0, width: this.offsetWidth, height: this.offsetHeight };
            },
            getContext: () => context,
            querySelector: () => null,
            querySelectorAll: () => [],
        };
    };

    global.self = global;
    global.window = {
        location: { search: "", hash: "", origin: "http://test.invalid", pathname: "/" },
        devicePixelRatio: 1,
        addEventListener() {},
        removeEventListener() {},
    };
    global.location = window.location;
    Object.defineProperty(global, "navigator", {
        configurable: true,
        value: {
            userAgent: "Node.js",
            clipboard: { readText: async () => "", writeText: async () => {} },
        },
    });
    global.document = {
        head: makeElement("head"),
        body: makeElement("body"),
        hidden: false,
        createElement: makeElement,
        getElementById: () => null,
        querySelectorAll: () => [],
        addEventListener() {},
        removeEventListener() {},
    };
    global.requestAnimationFrame = () => 1;
    global.cancelAnimationFrame = () => {};
    global.Path2D = class Path2D {};
    global.CustomEvent = class CustomEvent {
        constructor(type, init = {}) {
            this.type = type;
            this.detail = init.detail;
            this.bubbles = Boolean(init.bubbles);
            this.cancelable = Boolean(init.cancelable);
            this.defaultPrevented = false;
        }
        preventDefault() {
            if (this.cancelable) this.defaultPrevented = true;
        }
    };

    return makeElement;
}

test("raw nested Material Function data renders with metadata and activation", () => {
    const makeElement = installBrowserGlobals();
    const Klee = require("../dist/klee.min.js");
    const source = fs.readFileSync(
        path.join(__dirname, "fixtures/material-function-node.txt"),
        "utf8"
    );
    const canvas = makeElement("canvas");
    const viewer = Klee.init(canvas);

    assert.doesNotThrow(() => viewer.display(source));
    assert.equal(viewer.app.scene.nodes.length, 1);

    const node = viewer.app.scene.nodes[0];
    assert.deepEqual(node.activationDetail, {
        nodeName: "MaterialGraphNode_2",
        nodeClass: "/Script/UnrealEd.MaterialGraphNode",
        title: "GetUserInterfaceUV",
        expressionClass: "/Script/Engine.MaterialExpressionMaterialFunctionCall",
        assetName: "GetUserInterfaceUV",
        objectPath: "/Engine/Functions/UserInterface/GetUserInterfaceUV.GetUserInterfaceUV",
        reference: {
            kind: "material-function",
            displayName: "GetUserInterfaceUV",
            assetName: "GetUserInterfaceUV",
            objectPath: "/Engine/Functions/UserInterface/GetUserInterfaceUV.GetUserInterfaceUV",
            builtin: true,
            navigable: true,
        },
        references: [{
            kind: "material-function",
            displayName: "GetUserInterfaceUV",
            assetName: "GetUserInterfaceUV",
            objectPath: "/Engine/Functions/UserInterface/GetUserInterfaceUV.GetUserInterfaceUV",
            builtin: true,
            navigable: true,
        }],
    });

    let activationDetail;
    canvas.addEventListener(Klee.KLEE_NODE_ACTIVATE_EVENT, event => {
        activationDetail = event.detail;
    });

    const camera = viewer.app.scene.camera;
    const nodeCenterX = node.position.x + node.size.x / 2;
    const nodeCenterY = node.position.y + node.size.y / 2;
    canvas.emit("dblclick", {
        button: 0,
        clientX: nodeCenterX * camera.scale + camera.position.x,
        clientY: nodeCenterY * camera.scale + camera.position.y,
    });

    assert.deepEqual(activationDetail, node.activationDetail);

    const topSource = source
        .replaceAll("MaterialGraphNode_2", "MaterialGraphNode_3")
        .replaceAll("MaterialExpressionMaterialFunctionCall_0", "MaterialExpressionMaterialFunctionCall_1")
        .replaceAll("GetUserInterfaceUV", "MF_Topmost");
    viewer.display(`${source}\n${topSource}`);
    const topNode = viewer.app.scene.nodes[1];
    const overlapCamera = viewer.app.scene.camera;
    canvas.emit("dblclick", {
        button: 0,
        clientX: (topNode.position.x + topNode.size.x / 2) * overlapCamera.scale + overlapCamera.position.x,
        clientY: (topNode.position.y + topNode.size.y / 2) * overlapCamera.scale + overlapCamera.position.y,
    });

    assert.equal(activationDetail.title, "MF_Topmost");
    assert.equal(activationDetail.nodeName, "MaterialGraphNode_3");
});

test("Material graphs expose inspection, conservative root inputs, and W preview targets", () => {
    const makeElement = installBrowserGlobals();
    const Klee = require("../dist/klee.min.js");
    const rootSource = [
        'Begin Object Class=/Script/UnrealEd.MaterialGraphNode_Root Name="MaterialGraphNode_Root_0"',
        'Material="/Script/UnrealEd.PreviewMaterial\'/Engine/Transient.M_Test\'"',
        'NodePosX=400',
        'NodePosY=0',
        'CustomProperties Pin (PinId=ROOT1,PinName="Base Color",PinType.PinCategory="materialinput",)',
        'CustomProperties Pin (PinId=ROOT2,PinName="Final Color",PinType.PinCategory="materialinput",)',
        'CustomProperties Pin (PinId=ROOT3,PinName="Opacity",PinType.PinCategory="materialinput",)',
        'CustomProperties Pin (PinId=ROOT4,PinName="Opacity Mask",PinType.PinCategory="materialinput",)',
        'End Object',
    ].join('\n');
    const expressionSource = [
        'Begin Object Class=/Script/UnrealEd.MaterialGraphNode Name="MaterialGraphNode_0"',
        'Begin Object Class=/Script/Engine.MaterialExpressionMultiply Name="MaterialExpressionMultiply_0"',
        'End Object',
        'MaterialExpression="/Script/Engine.MaterialExpressionMultiply\'MaterialExpressionMultiply_0\'"',
        'NodePosX=0',
        'NodePosY=0',
        'CustomProperties Pin (PinId=OUT1,PinName="Result",Direction="EGPD_Output",PinType.PinCategory="float",LinkedTo=(MaterialGraphNode_Root_0 ROOT1,),)',
        'End Object',
    ].join('\n');
    const canvas = makeElement("canvas");
    const viewer = Klee.init(canvas);

    const inspection = viewer.display(`${rootSource}\n${expressionSource}`, {
        graph: {
            material: {
                domain: "MD_UI",
                blendMode: "BLEND_Translucent",
                unrealVersion: "5.7",
            },
        },
    });

    assert.equal(inspection.kind, "material");
    assert.equal(viewer.inspection, inspection);
    assert.deepEqual(inspection.material.rootInputPolicy.activeInputs, ["Final Color", "Opacity"]);
    assert.equal(inspection.preview.pixelRenderingAvailable, false);
    const previewButton = viewer.app._overlay.previewButton;
    const previewStatus = viewer.app._overlay.previewStatus;
    assert.equal(previewButton.tabIndex, 0);
    assert.equal(previewButton.getAttribute("data-klee-preview-control"), "true");
    assert.equal(previewButton.getAttribute("aria-describedby"), previewStatus.id);
    const secondViewer = Klee.init(makeElement("canvas"));
    assert.notEqual(secondViewer.app._overlay.previewStatus.id, previewStatus.id);

    const root = viewer.app.scene.nodes.find(node => node.name === "MaterialGraphNode_Root_0");
    const expression = viewer.app.scene.nodes.find(node => node.name === "MaterialGraphNode_0");
    assert.deepEqual(root.pins.filter(pin => pin.visible).map(pin => pin.pinProperty.name), ["Final Color", "Opacity"]);
    assert.equal(viewer.app.scene._controls.length, 3, "a link to a filtered root pin must not become a dangling wire");
    assert.equal(root.previewed, true);
    assert.equal(viewer.getPreviewState().active, false);

    const hiddenAllowedCanvas = makeElement("canvas");
    const hiddenAllowedViewer = Klee.init(hiddenAllowedCanvas);
    const hiddenAllowedRoot = rootSource.replace(
        'PinId=ROOT2,PinName="Final Color",PinType.PinCategory="materialinput",)',
        'PinId=ROOT2,PinName="Final Color",PinType.PinCategory="materialinput",bHidden=True,)'
    );
    hiddenAllowedViewer.display(hiddenAllowedRoot, {
        graph: { material: { rootInputs: ["Final Color", "Opacity"] } },
    });
    assert.deepEqual(
        hiddenAllowedViewer.app.scene.nodes[0].pins.filter(pin => pin.visible).map(pin => pin.pinProperty.name),
        ["Opacity"],
        "root policy must preserve Unreal's serialized hidden state"
    );
    assert.equal(viewer.getPreviewState().nodeName, root.name);

    let previewDetail;
    canvas.addEventListener(Klee.KLEE_PREVIEW_CHANGE_EVENT, event => { previewDetail = event.detail; });
    viewer.app.scene.selectOnly(expression);
    viewer.togglePreviewSelected();
    assert.equal(previewDetail.active, true);
    assert.equal(previewDetail.nodeName, expression.name);
    assert.equal(previewDetail.pixelRenderingAvailable, false);
    assert.equal(expression.previewed, true);
    assert.equal(root.previewed, false);

    viewer.togglePreviewSelected();
    assert.equal(viewer.getPreviewState().active, false);
    assert.equal(root.previewed, true);

    let prevented = false;
    viewer.app.scene.selectOnly(expression);
    canvas.onkeydown({
        code: "KeyW",
        ctrlKey: false,
        preventDefault() { prevented = true; },
    });
    assert.equal(prevented, true);
    assert.equal(viewer.getPreviewState().active, true);

    viewer.app.scene.selectAllNodes();
    canvas.onkeydown({ code: "KeyW", ctrlKey: false, preventDefault() {} });
    assert.equal(previewDetail.reason, "multiple-selection");
    assert.equal(viewer.getPreviewState().active, true);

    viewer.app.scene.clearSelection();
    canvas.onkeydown({ code: "KeyW", ctrlKey: false, preventDefault() {} });
    assert.equal(previewDetail.reason, "no-selection");
    assert.equal(viewer.getPreviewState().active, false);
    assert.equal(viewer.getPreviewState().nodeName, root.name);

    prevented = false;
    viewer.app.scene.selectOnly(expression);
    canvas.onkeydown({
        code: "KeyW",
        ctrlKey: false,
        shiftKey: true,
        altKey: false,
        metaKey: false,
        preventDefault() { prevented = true; },
    });
    assert.equal(prevented, false);
    assert.equal(viewer.getPreviewState().active, false);

    const expressionBSource = expressionSource
        .replaceAll("MaterialGraphNode_0", "MaterialGraphNode_1")
        .replaceAll("MaterialExpressionMultiply_0", "MaterialExpressionMultiply_1")
        .replaceAll("OUT1", "OUT2")
        .replace("NodePosX=0", "NodePosX=200")
        .replace("LinkedTo=(MaterialGraphNode_Root_0 ROOT1,),", "");
    viewer.display(`${rootSource}\n${expressionSource}\n${expressionBSource}`, {
        graph: { material: { domain: "MD_UI", blendMode: "BLEND_Translucent", unrealVersion: "5.7" } },
    });
    const expressionA = viewer.app.scene.nodes.find(node => node.name === "MaterialGraphNode_0");
    const expressionB = viewer.app.scene.nodes.find(node => node.name === "MaterialGraphNode_1");
    viewer.app.scene.selectOnly(expressionA);
    viewer.app.refresh();
    viewer.togglePreviewSelected();
    assert.equal(previewButton.textContent, "Use root");
    viewer.app.scene.selectOnly(expressionB);
    viewer.app.refresh();
    assert.equal(previewButton.textContent, "Preview");
    assert.equal(previewButton.getAttribute("aria-label"), "Preview selected Material node");
    assert.equal(previewButton.title, "Preview the selected Material node (W)");
    viewer.app.scene.selectAllNodes();
    viewer.app.refresh();
    assert.equal(previewButton.disabled, true);
    assert.equal(previewButton.textContent, "Preview");
});

test("Blueprint graph references and unknown nodes use the generic activation contract", () => {
    const makeElement = installBrowserGlobals();
    const Klee = require("../dist/klee.min.js");
    const source = [
        'Begin Object Class=/Script/BlueprintGraph.K2Node_CallFunction Name="K2Node_CallFunction_0"',
        'FunctionReference=(MemberParent=BlueprintGeneratedClass\'"/Game/UI/BP_Helper.BP_Helper_C"\',MemberName="BuildWidget",MemberGuid=ABC123)',
        'NodePosX=0',
        'NodePosY=0',
        'End Object',
        'Begin Object Class=/Script/BlueprintGraph.K2Node_CallFunction Name="K2Node_CallFunction_1"',
        'FunctionReference=(MemberParent=Class\'"/Script/Engine.KismetSystemLibrary"\',MemberName="PrintString")',
        'NodePosX=250',
        'NodePosY=0',
        'End Object',
        'Begin Object Class=/Script/BlueprintGraph.K2Node_MacroInstance Name="K2Node_MacroInstance_0"',
        'MacroGraphReference=(MacroGraph=EdGraph\'"/Game/UI/BP_Macros.BP_Macros:ForLoopWithBreak"\',GraphBlueprint=Blueprint\'"/Game/UI/BP_Macros.BP_Macros"\',GraphGuid=DEF456)',
        'NodePosX=500',
        'NodePosY=0',
        'End Object',
        'Begin Object Class=/Script/BlueprintGraph.K2Node_Composite Name="K2Node_Composite_9"',
        'BoundGraph=EdGraph\'"/Game/UI/BP_Main.BP_Main:Collapsed Detail"\'',
        'NodePosX=750',
        'NodePosY=0',
        'End Object',
        'Begin Object Class=/Script/MyPlugin.K2Node_FancyProcedural Name="K2Node_FancyProcedural_17"',
        'NodePosX=1000',
        'NodePosY=0',
        'CustomProperties Pin (PinId=CUSTOM1,PinName="Value",Direction="EGPD_Output",PinType.PinCategory="float",)',
        'End Object',
        'Begin Object Class=/Script/BlueprintGraph.K2Node_MacroInstance Name="K2Node_MacroInstance_Broken"',
        'NodePosX=1250',
        'NodePosY=0',
        'End Object',
        'Begin Object Class=/Script/MyPlugin.K2Node_CustomMacro Name="K2Node_CustomMacro_0"',
        'MacroGraphReference=(MacroGraph=EdGraph\'"/Game/UI/BP_PluginMacros.BP_PluginMacros:BuildWidget"\',GraphBlueprint=Blueprint\'"/Game/UI/BP_PluginMacros.BP_PluginMacros"\',GraphGuid=ABC789)',
        'NodePosX=1500',
        'NodePosY=0',
        'End Object',
        'Begin Object Class=/Script/MyPlugin.K2Node_CustomHelper Name="K2Node_CustomHelper_0"',
        'FunctionReference=(MemberParent=BlueprintGeneratedClass\'"/Game/UI/BP_Helper.BP_Helper_C"\',MemberName="BuildWidget",MemberGuid=FED321)',
        'NodePosX=1750',
        'NodePosY=0',
        'End Object',
    ].join('\n');
    const canvas = makeElement("canvas");
    const viewer = Klee.init(canvas);
    const inspection = viewer.display(source);

    assert.equal(inspection.kind, "blueprint");
    assert.equal(viewer.app.scene.nodes.length, 8);

    const helper = viewer.app.scene.nodes[0].activationDetail;
    assert.equal(helper.reference.kind, "blueprint-function");
    assert.equal(helper.reference.objectPath, "/Game/UI/BP_Helper.BP_Helper_C");
    assert.equal(helper.reference.memberName, "BuildWidget");
    assert.equal(helper.reference.guid, "ABC123");
    assert.equal(helper.reference.navigable, true);
    assert.deepEqual(helper.references, [helper.reference]);

    const nativeFunction = viewer.app.scene.nodes[1].activationDetail.reference;
    assert.equal(nativeFunction.builtin, true);
    assert.equal(nativeFunction.navigable, false);

    const macro = viewer.app.scene.nodes[2].activationDetail.reference;
    assert.equal(macro.kind, "blueprint-macro");
    assert.equal(macro.displayName, "For Loop With Break");
    assert.equal(macro.objectPath, "/Game/UI/BP_Macros.BP_Macros");
    assert.equal(macro.graphName, "ForLoopWithBreak");
    assert.equal(macro.guid, "DEF456");

    const collapsed = viewer.app.scene.nodes[3].activationDetail.reference;
    assert.equal(collapsed.kind, "collapsed-graph");
    assert.equal(collapsed.objectPath, "/Game/UI/BP_Main.BP_Main");
    assert.equal(collapsed.graphName, "Collapsed Detail");

    const unknown = viewer.app.scene.nodes[4];
    assert.equal(unknown.title, "Fancy Procedural");
    assert.equal(unknown.name, "K2Node_FancyProcedural_17");
    assert.equal(unknown.pins.length, 1);

    assert.equal(inspection.diagnostics.some(diagnostic =>
        diagnostic.code === "node-parser-fallback" && diagnostic.nodeName === "K2Node_MacroInstance_Broken"), true);
    assert.equal(inspection.diagnostics.some(diagnostic =>
        diagnostic.code === "node-generic-fallback" && diagnostic.nodeName === "K2Node_FancyProcedural_17"), true);

    const customMacro = viewer.app.scene.nodes[6].activationDetail;
    assert.equal(customMacro.title, "Build Widget");
    assert.equal(customMacro.reference.kind, "blueprint-macro");
    assert.equal(customMacro.reference.objectPath, "/Game/UI/BP_PluginMacros.BP_PluginMacros");
    assert.equal(customMacro.reference.displayName, "Build Widget");
    assert.equal(customMacro.reference.graphName, "BuildWidget");

    const customHelper = viewer.app.scene.nodes[7].activationDetail;
    assert.equal(customHelper.title, "Build Widget");
    assert.equal(customHelper.reference.displayName, "Build Widget");
    assert.equal(customHelper.reference.memberName, "BuildWidget");
});

test("plugin MaterialGraphNode subclasses retain Material titles and references", () => {
    const makeElement = installBrowserGlobals();
    const Klee = require("../dist/klee.min.js");
    const source = fs.readFileSync(
        path.join(__dirname, "fixtures/material-function-node.txt"),
        "utf8"
    ).replace(
        "/Script/UnrealEd.MaterialGraphNode",
        "/Script/MyMaterialPlugin.MaterialGraphNode_Enhanced"
    );
    const viewer = Klee.init(makeElement("canvas"));
    const inspection = viewer.display(source);
    const activation = viewer.app.scene.nodes[0].activationDetail;

    assert.equal(inspection.kind, "material-fragment");
    assert.equal(activation.title, "GetUserInterfaceUV");
    assert.equal(activation.reference.kind, "material-function");
    assert.equal(activation.reference.objectPath, "/Engine/Functions/UserInterface/GetUserInterfaceUV.GetUserInterfaceUV");

    const genericViewer = Klee.init(makeElement("canvas"));
    genericViewer.display([
        'Begin Object Class=/Script/MyMaterialPlugin.MaterialGraphNode_Special Name="MaterialGraphNode_Special_0"',
        'NodePosX=0',
        'NodePosY=0',
        'CustomProperties Pin (PinId=CUSTOM1,PinName="Value",Direction="EGPD_Output",PinType.PinCategory="float",)',
        'End Object',
    ].join('\n'));
    assert.equal(genericViewer.app.scene.nodes[0].title, "Special");
});

module.exports = { installBrowserGlobals };
