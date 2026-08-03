/**
 * Minimal DOM stand-in for running the built bundle under `node --test`.
 *
 * Listener registration is tracked rather than discarded, and `{ signal }` is
 * honoured, so tests can assert that teardown actually detaches what setup
 * attached. `pendingAnimationFrames` exposes the same for the frame loop.
 */

function makeListenerTarget() {
    const listeners = new Map();

    const add = (type, listener, options) => {
        const typeListeners = listeners.get(type) || [];
        typeListeners.push(listener);
        listeners.set(type, typeListeners);
        const signal = options && typeof options === "object" ? options.signal : undefined;
        if (signal) {
            if (signal.aborted) {
                remove(type, listener);
                return;
            }
            signal.addEventListener("abort", () => remove(type, listener), { once: true });
        }
    };

    const remove = (type, listener) => {
        listeners.set(type, (listeners.get(type) || []).filter(candidate => candidate !== listener));
    };

    return {
        addEventListener: add,
        removeEventListener: remove,
        listenerCount(type) {
            return (listeners.get(type) || []).length;
        },
        totalListenerCount() {
            let total = 0;
            for (const typeListeners of listeners.values()) total += typeListeners.length;
            return total;
        },
        emit(type, event) {
            for (const listener of [...(listeners.get(type) || [])]) listener(event);
        },
        dispatchEvent(event) {
            this.emit(event.type, event);
            return !event.defaultPrevented;
        },
    };
}

function installBrowserGlobals() {
    const makeClassList = () => {
        const values = new Set();
        return {
            add: (...items) => items.forEach(item => values.add(item)),
            remove: (...items) => items.forEach(item => values.delete(item)),
            contains: item => values.has(item),
            toggle(item, force = !values.has(item)) {
                force ? values.add(item) : values.delete(item);
                return force;
            },
        };
    };

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

        return Object.assign(makeListenerTarget(), {
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
                child.parentElement?.removeChild(child);
                this.children.push(child);
                child.parentElement = this;
                return child;
            },
            insertBefore(child, reference) {
                child.parentElement?.removeChild(child);
                const index = this.children.indexOf(reference);
                this.children.splice(index < 0 ? this.children.length : index, 0, child);
                child.parentElement = this;
                return child;
            },
            removeChild(child) {
                const index = this.children.indexOf(child);
                if (index >= 0) this.children.splice(index, 1);
                if (child.parentElement === this) child.parentElement = null;
                return child;
            },
            remove() {
                this.parentElement?.removeChild(this);
            },
            contains(node) {
                if (node === this) return true;
                return this.children.some(child => child.contains?.(node));
            },
            focus() {},
            click() {},
            setAttribute(name, value) {
                attributes.set(name, String(value));
            },
            removeAttribute(name) {
                attributes.delete(name);
            },
            getAttribute: name => attributes.get(name) ?? null,
            getAttributeNode: name => attributes.has(name) ? { value: attributes.get(name) } : null,
            getBoundingClientRect() {
                return { left: 0, top: 0, width: this.offsetWidth, height: this.offsetHeight };
            },
            getContext: () => context,
            querySelector: () => null,
            querySelectorAll: () => [],
        });
    };

    global.self = global;
    global.window = Object.assign(makeListenerTarget(), {
        location: { search: "", hash: "", origin: "http://test.invalid", pathname: "/" },
        devicePixelRatio: 1,
        clearTimeout: () => {},
        setTimeout: () => 0,
    });
    global.location = window.location;
    Object.defineProperty(global, "navigator", {
        configurable: true,
        value: {
            userAgent: "Node.js",
            clipboard: { readText: async () => "", writeText: async () => {} },
        },
    });
    global.document = Object.assign(makeListenerTarget(), {
        head: makeElement("head"),
        body: makeElement("body"),
        hidden: false,
        createElement: makeElement,
        getElementById: () => null,
        querySelectorAll: () => [],
    });

    const pendingAnimationFrames = new Set();
    let nextAnimationFrameId = 0;
    global.requestAnimationFrame = () => {
        const id = ++nextAnimationFrameId;
        pendingAnimationFrames.add(id);
        return id;
    };
    global.cancelAnimationFrame = (id) => {
        pendingAnimationFrames.delete(id);
    };
    global.pendingAnimationFrames = pendingAnimationFrames;

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

module.exports = { installBrowserGlobals, makeListenerTarget };
