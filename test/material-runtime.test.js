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

module.exports = { installBrowserGlobals };
