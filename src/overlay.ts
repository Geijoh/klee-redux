import { Application } from "./application";
import { Vector2 } from "./math/vector2";

const OVERLAY_CLASS = "klee-overlay";
const STYLE_ID = "klee-overlay-style";

const OVERLAY_CSS = `
.${OVERLAY_CLASS} {
    position: relative;
    display: block;
    color: #e8ecf4;
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    line-height: 1.2;
}
.${OVERLAY_CLASS} canvas.klee {
    display: block;
    width: 100%;
}
.${OVERLAY_CLASS} .klee-toolbar {
    position: absolute;
    top: 10px;
    left: 10px;
    display: flex;
    gap: 6px;
    align-items: center;
    padding: 6px;
    background: rgba(18, 22, 30, 0.85);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 8px;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    z-index: 5;
    font-size: 12px;
    user-select: none;
    pointer-events: auto;
}
.${OVERLAY_CLASS} .klee-toolbar button,
.${OVERLAY_CLASS} .klee-toolbar .klee-zoom-display {
    background: transparent;
    color: #d8dde8;
    border: none;
    border-radius: 5px;
    height: 28px;
    min-width: 28px;
    padding: 0 8px;
    cursor: pointer;
    font-size: 12px;
    font-weight: 500;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    transition: background-color 120ms ease, color 120ms ease;
}
.${OVERLAY_CLASS} .klee-toolbar button:hover {
    background: rgba(255,255,255,0.06);
    color: #fff;
}
.${OVERLAY_CLASS} .klee-toolbar button:active {
    background: rgba(255,255,255,0.10);
}
.${OVERLAY_CLASS} .klee-toolbar button:focus-visible {
    outline: 2px solid #73b9ff;
    outline-offset: 2px;
}
.${OVERLAY_CLASS} canvas:focus-visible {
    outline: 2px solid #73b9ff;
    outline-offset: -2px;
}
.${OVERLAY_CLASS} .klee-toolbar button:disabled {
    cursor: not-allowed;
    opacity: 0.45;
}
.${OVERLAY_CLASS} .klee-toolbar button.klee-preview-active {
    background: rgba(69, 166, 255, 0.2);
    color: #9ed2ff;
}
.${OVERLAY_CLASS} .klee-toolbar button.klee-toggle.on {
    background: rgba(249, 115, 0, 0.18);
    color: #ffb070;
}
.${OVERLAY_CLASS} .klee-toolbar button.klee-toggle.on:hover {
    background: rgba(249, 115, 0, 0.28);
    color: #ffd3a6;
}
.${OVERLAY_CLASS} .klee-toolbar .klee-toolbar-sep {
    width: 1px;
    height: 18px;
    background: rgba(255,255,255,0.08);
    margin: 0 2px;
}
.${OVERLAY_CLASS} .klee-toolbar .klee-zoom-display {
    cursor: default;
    color: #a7b0c0;
    min-width: 44px;
    font-variant-numeric: tabular-nums;
}
.${OVERLAY_CLASS} .klee-search {
    position: absolute;
    top: 10px;
    right: 10px;
    display: none;
    align-items: center;
    gap: 4px;
    background: rgba(18, 22, 30, 0.92);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 8px;
    padding: 4px 6px;
    z-index: 5;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    font-size: 12px;
}
.${OVERLAY_CLASS} .klee-search.open {
    display: flex;
}
.${OVERLAY_CLASS} .klee-search input {
    background: transparent;
    border: none;
    outline: none;
    color: #e8ecf4;
    font-size: 12px;
    min-width: 160px;
    padding: 4px 6px;
    font-family: inherit;
}
.${OVERLAY_CLASS} .klee-search input::placeholder {
    color: #6f7a8c;
}
.${OVERLAY_CLASS} .klee-search .klee-search-count {
    color: #8892a3;
    font-size: 11px;
    min-width: 32px;
    text-align: center;
    font-variant-numeric: tabular-nums;
}
.${OVERLAY_CLASS} .klee-search button {
    background: transparent;
    color: #d8dde8;
    border: none;
    border-radius: 4px;
    width: 22px;
    height: 22px;
    cursor: pointer;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
}
.${OVERLAY_CLASS} .klee-search button:hover {
    background: rgba(255,255,255,0.08);
}
.${OVERLAY_CLASS} .klee-minimap {
    position: absolute;
    right: 10px;
    bottom: 10px;
    width: 180px;
    height: 120px;
    background: rgba(14, 17, 23, 0.85);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 8px;
    overflow: hidden;
    z-index: 4;
    pointer-events: auto;
    cursor: pointer;
}
.${OVERLAY_CLASS} .klee-minimap canvas {
    display: block;
    width: 100%;
    height: 100%;
}
.${OVERLAY_CLASS} .klee-toast {
    position: absolute;
    left: 50%;
    top: 14px;
    transform: translateX(-50%);
    background: rgba(14, 17, 23, 0.95);
    border: 1px solid rgba(255,255,255,0.08);
    color: #e8ecf4;
    padding: 8px 14px;
    border-radius: 6px;
    font-size: 12px;
    opacity: 0;
    pointer-events: none;
    transition: opacity 180ms ease;
    z-index: 10;
}
.${OVERLAY_CLASS} .klee-toast.show {
    opacity: 1;
}
.${OVERLAY_CLASS} .klee-visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
}
.${OVERLAY_CLASS} .klee-context-menu {
    position: absolute;
    min-width: 180px;
    background: rgba(20, 24, 32, 0.98);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 8px;
    padding: 4px;
    box-shadow: 0 6px 24px rgba(0,0,0,0.35);
    font-size: 12px;
    z-index: 20;
    display: none;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
}
.${OVERLAY_CLASS} .klee-context-menu.open {
    display: block;
}
.${OVERLAY_CLASS} .klee-context-menu button {
    display: flex;
    width: 100%;
    text-align: left;
    background: transparent;
    border: none;
    color: #e8ecf4;
    padding: 6px 10px;
    border-radius: 5px;
    cursor: pointer;
    font-size: 12px;
    gap: 8px;
    align-items: center;
    justify-content: space-between;
    font-family: inherit;
}
.${OVERLAY_CLASS} .klee-context-menu button:hover {
    background: rgba(255,255,255,0.06);
}
.${OVERLAY_CLASS} .klee-context-menu .klee-menu-shortcut {
    color: #6c7588;
    font-size: 11px;
}
.${OVERLAY_CLASS} .klee-context-menu .klee-menu-sep {
    height: 1px;
    background: rgba(255,255,255,0.06);
    margin: 4px 2px;
}
.${OVERLAY_CLASS} .klee-badge {
    position: absolute;
    right: 10px;
    bottom: 10px;
    background: rgba(14,17,23,0.85);
    border: 1px solid rgba(255,255,255,0.08);
    color: #a7b0c0;
    font-size: 10px;
    padding: 3px 8px;
    border-radius: 999px;
    text-decoration: none;
    z-index: 4;
    font-family: inherit;
}
.${OVERLAY_CLASS} .klee-badge:hover {
    color: #fff;
    background: rgba(20, 24, 32, 0.95);
}
.${OVERLAY_CLASS}.klee-embed .klee-toolbar {
    top: 8px;
    left: 8px;
    padding: 4px;
}
.${OVERLAY_CLASS}.klee-embed .klee-minimap {
    display: none;
}
`;

interface ToolbarButton {
    id: string;
    label: string;
    title: string;
    onClick: () => void;
}

export class Overlay {

    private static previewStatusCounter: number = 0;

    private app: Application;
    private root: HTMLDivElement;
    private toolbar: HTMLDivElement;
    private zoomDisplay: HTMLSpanElement;
    private searchBox: HTMLDivElement;
    private searchInput: HTMLInputElement;
    private searchCount: HTMLSpanElement;
    private minimap: HTMLDivElement;
    private minimapCanvas: HTMLCanvasElement;
    private contextMenu: HTMLDivElement;
    private toast: HTMLDivElement;
    private previewButton: HTMLButtonElement;
    private previewStatus: HTMLDivElement;
    private previewStatusId: string;

    private searchMatches: number[] = [];
    private searchIndex: number = -1;

    constructor(app: Application) {
        this.app = app;
        this.previewStatusId = `klee-preview-status-${++Overlay.previewStatusCounter}`;
        Overlay.injectStylesOnce();

        this.wrapCanvas();
        this.buildToolbar();
        this.buildPreviewStatus();
        this.buildSearchBox();
        this.buildMinimap();
        this.buildContextMenu();
        this.buildToast();
        this.wireKeyboardAndContextEvents();

        if (app.embedMode) {
            this.root.classList.add("klee-embed");
            this.addBadge();
        }

        requestAnimationFrame(() => {
            this.app.refresh();
            this.onSceneRefreshed();
        });
    }

    private static injectStylesOnce() {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement("style");
        style.id = STYLE_ID;
        style.textContent = OVERLAY_CSS;
        document.head.appendChild(style);
    }

    private wrapCanvas() {
        const canvas = this.app.element;
        const parent = canvas.parentElement;
        if (!parent) {
            this.root = document.createElement("div");
            this.root.className = OVERLAY_CLASS;
            return;
        }
        this.root = document.createElement("div");
        this.root.className = OVERLAY_CLASS;
        parent.insertBefore(this.root, canvas);
        this.root.appendChild(canvas);
    }

    private buildToolbar() {
        this.toolbar = document.createElement("div");
        this.toolbar.className = "klee-toolbar";

        const buttons: ToolbarButton[] = [
            { id: "zoom-out", label: "−", title: "Zoom out", onClick: () => { this.app.zoomOutAtCenter(); } },
            { id: "zoom-in",  label: "+", title: "Zoom in",  onClick: () => { this.app.zoomInAtCenter(); } },
        ];

        for (const b of buttons) {
            const btn = this.makeButton(b.label, b.title);
            btn.addEventListener("click", b.onClick);
            this.toolbar.appendChild(btn);
        }

        this.zoomDisplay = document.createElement("span");
        this.zoomDisplay.className = "klee-zoom-display";
        this.zoomDisplay.textContent = "100%";
        this.zoomDisplay.title = "Current zoom";
        this.toolbar.appendChild(this.zoomDisplay);

        this.toolbar.appendChild(this.makeSeparator());

        const fitBtn = this.makeButton("Fit", "Fit all nodes to view");
        fitBtn.addEventListener("click", () => this.app.fitToView());
        this.toolbar.appendChild(fitBtn);

        const homeBtn = this.makeButton("Home", "Center view");
        homeBtn.addEventListener("click", () => { this.app.resetZoom(); });
        this.toolbar.appendChild(homeBtn);

        this.toolbar.appendChild(this.makeSeparator());

        const searchBtn = this.makeButton("Search", "Search nodes (Ctrl+F)");
        searchBtn.addEventListener("click", () => this.toggleSearch());
        this.toolbar.appendChild(searchBtn);

        this.previewButton = this.makeButton("Preview", "Preview the selected Material node (W)");
        this.previewButton.tabIndex = 0;
        this.previewButton.classList.add("klee-preview-toggle");
        this.previewButton.setAttribute("data-klee-preview-control", "true");
        this.previewButton.setAttribute("aria-label", "Preview selected Material node");
        this.previewButton.setAttribute("aria-keyshortcuts", "W");
        this.previewButton.setAttribute("aria-pressed", "false");
        this.previewButton.setAttribute("aria-describedby", this.previewStatusId);
        this.previewButton.addEventListener("click", () => {
            const state = this.app.togglePreviewSelected();
            this.updatePreviewControls(state);
        });
        this.toolbar.appendChild(this.previewButton);

        const shareBtn = this.makeButton("Share", "Copy share link");
        shareBtn.addEventListener("click", async () => {
            await this.app.copyShareLink();
            this.showToast("Share link copied to clipboard");
        });
        this.toolbar.appendChild(shareBtn);

        const exportBtn = this.makeButton("Export", "Export view as PNG (click Fit first for full graph)");
        exportBtn.addEventListener("click", async () => {
            await this.app.exportPNG();
            this.showToast("Blueprint exported");
        });
        this.toolbar.appendChild(exportBtn);

        const animateBtn = this.makeButton("Flow", "Toggle animated exec wires");
        animateBtn.classList.add("klee-toggle", "on");
        animateBtn.addEventListener("click", () => {
            const next = !animateBtn.classList.contains("on");
            animateBtn.classList.toggle("on", next);
            this.app.setAnimationEnabled(next);
        });
        this.toolbar.appendChild(animateBtn);

        this.root.appendChild(this.toolbar);
    }

    private buildPreviewStatus() {
        this.previewStatus = document.createElement("div");
        this.previewStatus.id = this.previewStatusId;
        this.previewStatus.className = "klee-visually-hidden";
        this.previewStatus.setAttribute("role", "status");
        this.previewStatus.setAttribute("aria-live", "polite");
        this.root.appendChild(this.previewStatus);
        this.app.element.addEventListener("klee:previewchange", (event: CustomEvent) =>
            this.updatePreviewControls(event.detail));
        this.updatePreviewControls();
    }

    private updatePreviewControls(previewState?) {
        if (!this.previewButton || !this.previewStatus) return;
        const inspection = this.app.inspection;
        const state = previewState || this.app.getPreviewState();
        const available = Boolean(inspection?.preview.targetSelectionAvailable);
        const selectedNodes = this.app.scene.selectedNodes;
        const selectedNode = selectedNodes.length === 1 ? selectedNodes[0] : undefined;
        const useRootAction = Boolean(state.active && (
            selectedNodes.length === 0 ||
            selectedNode?.name === state.nodeName ||
            selectedNode?.name === state.rootNodeName
        ));
        const selectionInvalid = selectedNodes.length > 1 || (selectedNodes.length === 0 && !state.active);
        this.previewButton.disabled = !available || selectionInvalid;
        this.previewButton.classList.toggle("klee-preview-active", state.active);
        this.previewButton.setAttribute("aria-pressed", state.active ? "true" : "false");
        this.previewButton.textContent = useRootAction ? "Use root" : "Preview";
        this.previewButton.setAttribute("aria-label", useRootAction
            ? "Stop previewing selected node and use Material output"
            : "Preview selected Material node");

        if (state.reason === "multiple-selection") {
            this.previewStatus.textContent = "Select exactly one Material node to choose a preview target.";
        } else if (state.reason === "no-selection") {
            this.previewStatus.textContent = state.rootNodeName
                ? "No node is selected; the preview target is the Material output."
                : "No node is selected and this pasted graph has no Material output node.";
        } else if (state.reason === "unsupported-node") {
            this.previewStatus.textContent = "The selected item is not a previewable Material node.";
        } else if (!available) {
            this.previewButton.title = "Node preview is available for Material graphs only";
            this.previewStatus.textContent = "Node preview is unavailable because this is not a Material graph.";
        } else if (selectedNodes.length > 1) {
            this.previewButton.title = "Select exactly one Material node to preview";
        } else if (selectedNodes.length === 0 && !state.active) {
            this.previewButton.title = "Select one Material node to preview";
            this.previewStatus.textContent = state.rootNodeName
                ? "Preview target is the Material output. Select one Material node and choose Preview. Pixel rendering is unavailable in this viewer."
                : "No Material output node was pasted. Select one Material node to mark a preview target. Pixel rendering is unavailable in this viewer.";
        } else if (state.active) {
            this.previewButton.title = useRootAction
                ? "Return preview targeting to the Material output (W)"
                : "Preview the selected Material node (W)";
            this.previewStatus.textContent = `Preview target: ${state.title || state.nodeName}. Pixel rendering is unavailable in this viewer.`;
        } else {
            this.previewButton.title = "Mark the selected Material node as the preview target (W)";
            this.previewStatus.textContent = "No Material output node was pasted. Select one Material node to mark a preview target. Pixel rendering is unavailable in this viewer.";
        }
    }

    private makeButton(label: string, title: string): HTMLButtonElement {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = label;
        btn.title = title;
        btn.tabIndex = -1;
        return btn;
    }

    private makeSeparator(): HTMLDivElement {
        const sep = document.createElement("div");
        sep.className = "klee-toolbar-sep";
        return sep;
    }

    private buildSearchBox() {
        this.searchBox = document.createElement("div");
        this.searchBox.className = "klee-search";

        this.searchInput = document.createElement("input");
        this.searchInput.type = "text";
        this.searchInput.placeholder = "Search nodes...";
        this.searchInput.spellcheck = false;
        this.searchInput.addEventListener("input", () => this.runSearch());
        this.searchInput.addEventListener("keydown", (ev) => {
            if (ev.key === "Enter") {
                ev.preventDefault();
                if (ev.shiftKey) this.nextMatch(-1); else this.nextMatch(+1);
            } else if (ev.key === "Escape") {
                ev.preventDefault();
                this.toggleSearch(false);
            }
            ev.stopPropagation();
        });
        this.searchBox.appendChild(this.searchInput);

        this.searchCount = document.createElement("span");
        this.searchCount.className = "klee-search-count";
        this.searchCount.textContent = "";
        this.searchBox.appendChild(this.searchCount);

        const prevBtn = document.createElement("button");
        prevBtn.type = "button";
        prevBtn.textContent = "\u25B4";
        prevBtn.title = "Previous match (Shift+Enter)";
        prevBtn.addEventListener("click", () => this.nextMatch(-1));
        this.searchBox.appendChild(prevBtn);

        const nextBtn = document.createElement("button");
        nextBtn.type = "button";
        nextBtn.textContent = "\u25BE";
        nextBtn.title = "Next match (Enter)";
        nextBtn.addEventListener("click", () => this.nextMatch(+1));
        this.searchBox.appendChild(nextBtn);

        const closeBtn = document.createElement("button");
        closeBtn.type = "button";
        closeBtn.textContent = "\u00D7";
        closeBtn.title = "Close (Esc)";
        closeBtn.addEventListener("click", () => this.toggleSearch(false));
        this.searchBox.appendChild(closeBtn);

        this.root.appendChild(this.searchBox);
    }

    private buildMinimap() {
        this.minimap = document.createElement("div");
        this.minimap.className = "klee-minimap";
        this.minimap.title = "Minimap (click to jump)";
        this.minimapCanvas = document.createElement("canvas");
        this.minimap.appendChild(this.minimapCanvas);
        this.root.appendChild(this.minimap);
        this.minimap.addEventListener("click", (ev) => this.onMinimapClick(ev));
    }

    private buildContextMenu() {
        this.contextMenu = document.createElement("div");
        this.contextMenu.className = "klee-context-menu";
        this.root.appendChild(this.contextMenu);

        document.addEventListener("mousedown", (ev) => {
            if (!this.contextMenu.contains(ev.target as Node)) {
                this.hideContextMenu();
            }
        });
    }

    private buildToast() {
        this.toast = document.createElement("div");
        this.toast.className = "klee-toast";
        this.root.appendChild(this.toast);
    }

    private wireKeyboardAndContextEvents() {
        const canvas = this.app.element;
        canvas.addEventListener("keydown", (ev) => {
            if (ev.ctrlKey && ev.code === "KeyF") {
                ev.preventDefault();
                this.toggleSearch(true);
            }
        });
        canvas.addEventListener("contextmenu", (ev) => {
            ev.preventDefault();
            this.showContextMenuAt(ev.clientX, ev.clientY);
        });
        window.addEventListener("resize", () => this.onSceneRefreshed());
    }

    private toggleSearch(force?: boolean) {
        const shouldOpen = force !== undefined ? force : !this.searchBox.classList.contains("open");
        if (shouldOpen) {
            this.searchBox.classList.add("open");
            this.searchInput.focus();
            this.searchInput.select();
            this.runSearch();
        } else {
            this.searchBox.classList.remove("open");
            this.searchMatches = [];
            this.searchIndex = -1;
            this.app.element.focus();
        }
    }

    private runSearch() {
        const q = this.searchInput.value.trim().toLowerCase();
        if (!q) {
            this.searchMatches = [];
            this.searchIndex = -1;
            this.searchCount.textContent = "";
            return;
        }

        const nodes = this.app.scene.nodes;
        this.searchMatches = [];
        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i] as any;
            const primary = (node?.searchableText || "") as string;
            const fallback = (node?.sourceText || "") as string;
            if (primary.toLowerCase().indexOf(q) >= 0 ||
                (primary === "" && fallback.toLowerCase().indexOf(q) >= 0)) {
                this.searchMatches.push(i);
            }
        }

        if (this.searchMatches.length === 0) {
            this.searchIndex = -1;
            this.searchCount.textContent = "0/0";
            return;
        }

        this.searchIndex = 0;
        this.searchCount.textContent = `1/${this.searchMatches.length}`;
        this.app.focusOnNode(this.searchMatches[0]);
    }

    private nextMatch(direction: number) {
        if (this.searchMatches.length === 0) return;
        this.searchIndex = (this.searchIndex + direction + this.searchMatches.length) % this.searchMatches.length;
        this.searchCount.textContent = `${this.searchIndex + 1}/${this.searchMatches.length}`;
        this.app.focusOnNode(this.searchMatches[this.searchIndex]);
    }

    public onCameraChanged() {
        if (this.zoomDisplay) {
            const z = this.app.scene.camera.scale;
            this.zoomDisplay.textContent = `${Math.round(z * 100)}%`;
        }
        this.drawMinimap();
    }

    public onSceneRefreshed() {
        this.onCameraChanged();
        this.updatePreviewControls();
    }

    private drawMinimap() {
        if (!this.minimapCanvas) return;
        const nodes = this.app.scene.nodes;
        const canvas = this.minimapCanvas;

        const rect = this.minimap.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.max(1, Math.floor(rect.width * dpr));
        canvas.height = Math.max(1, Math.floor(rect.height * dpr));
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = "rgba(14,17,23,0.95)";
        ctx.fillRect(0, 0, rect.width, rect.height);

        if (nodes.length === 0) return;

        let xMin = Number.MAX_SAFE_INTEGER;
        let xMax = Number.MIN_SAFE_INTEGER;
        let yMin = Number.MAX_SAFE_INTEGER;
        let yMax = Number.MIN_SAFE_INTEGER;
        nodes.forEach(n => {
            xMin = Math.min(n.position.x, xMin);
            yMin = Math.min(n.position.y, yMin);
            xMax = Math.max(n.position.x + n.size.x, xMax);
            yMax = Math.max(n.position.y + n.size.y, yMax);
        });
        const worldW = Math.max(1, xMax - xMin);
        const worldH = Math.max(1, yMax - yMin);

        const pad = 6;
        const scale = Math.min((rect.width - pad * 2) / worldW, (rect.height - pad * 2) / worldH);
        const offX = pad + (rect.width - pad * 2 - worldW * scale) / 2 - xMin * scale;
        const offY = pad + (rect.height - pad * 2 - worldH * scale) / 2 - yMin * scale;

        nodes.forEach(n => {
            ctx.fillStyle = n.selected ? "rgba(231,158,0,0.9)" : "rgba(120,140,170,0.6)";
            ctx.fillRect(
                n.position.x * scale + offX,
                n.position.y * scale + offY,
                Math.max(1, n.size.x * scale),
                Math.max(1, n.size.y * scale));
        });

        const cam = this.app.scene.camera;
        const z = cam.scale;
        const viewLeft = -cam.position.x / z;
        const viewTop = -cam.position.y / z;
        const viewW = this.app.canvas.width / z;
        const viewH = this.app.canvas.height / z;
        ctx.strokeStyle = "rgba(255,255,255,0.5)";
        ctx.lineWidth = 1;
        ctx.strokeRect(
            viewLeft * scale + offX,
            viewTop * scale + offY,
            viewW * scale,
            viewH * scale);

        (this.minimap as any)._layout = { scale, offX, offY };
    }

    private onMinimapClick(ev: MouseEvent) {
        const layout = (this.minimap as any)._layout;
        if (!layout) return;
        const rect = this.minimap.getBoundingClientRect();
        const mx = ev.clientX - rect.left;
        const my = ev.clientY - rect.top;
        const worldX = (mx - layout.offX) / layout.scale;
        const worldY = (my - layout.offY) / layout.scale;
        const cam = this.app.scene.camera;
        cam.centerAbsolutePosition(new Vector2(-worldX, -worldY));
        this.app.refresh();
    }

    private showContextMenuAt(clientX: number, clientY: number) {
        const rect = this.root.getBoundingClientRect();
        this.contextMenu.innerHTML = "";

        const addItem = (label: string, shortcut: string | null, onClick: () => void, disabled = false) => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.disabled = disabled;
            const span = document.createElement("span");
            span.textContent = label;
            btn.appendChild(span);
            if (shortcut) {
                const s = document.createElement("span");
                s.className = "klee-menu-shortcut";
                s.textContent = shortcut;
                btn.appendChild(s);
            }
            btn.addEventListener("click", () => {
                this.hideContextMenu();
                onClick();
            });
            this.contextMenu.appendChild(btn);
        };

        const addSep = () => {
            const sep = document.createElement("div");
            sep.className = "klee-menu-sep";
            this.contextMenu.appendChild(sep);
        };

        addItem("Zoom in", "Wheel", () => this.app.zoomInAtCenter());
        addItem("Zoom out", "Wheel", () => this.app.zoomOutAtCenter());
        addItem("Fit to view", "", () => this.app.fitToView());
        addItem("Reset view", "Home", () => this.app.resetZoom());
        addSep();
        addItem("Search nodes", "Ctrl+F", () => this.toggleSearch(true));
        addItem("Select all nodes", "Ctrl+A", () => { this.app.selectAllNodes(); });
        addItem("Preview selected node", "W", () => { this.app.togglePreviewSelected(); },
            !this.app.inspection?.preview.targetSelectionAvailable);
        addSep();
        addItem("Copy blueprint", "Ctrl+C", async () => {
            await this.app.copyAllToClipboard();
            this.showToast("Blueprint copied to clipboard");
        });
        addItem("Copy share link", "", async () => {
            await this.app.copyShareLink();
            this.showToast("Share link copied to clipboard");
        });

        this.contextMenu.classList.add("open");
        const menuRect = this.contextMenu.getBoundingClientRect();
        let x = clientX - rect.left;
        let y = clientY - rect.top;
        if (x + menuRect.width > rect.width - 4) x = rect.width - menuRect.width - 4;
        if (y + menuRect.height > rect.height - 4) y = rect.height - menuRect.height - 4;
        this.contextMenu.style.left = `${Math.max(4, x)}px`;
        this.contextMenu.style.top = `${Math.max(4, y)}px`;
    }

    private hideContextMenu() {
        this.contextMenu.classList.remove("open");
    }

    private showToast(message: string) {
        this.toast.textContent = message;
        this.toast.classList.add("show");
        window.clearTimeout((this.toast as any)._hideTimer);
        (this.toast as any)._hideTimer = window.setTimeout(() => {
            this.toast.classList.remove("show");
        }, 1600);
    }

    private addBadge() {
        const badge = document.createElement("a");
        badge.className = "klee-badge";
        badge.href = "https://github.com/Joined-Forces/klee";
        badge.target = "_blank";
        badge.rel = "noopener";
        badge.textContent = "Klee";
        this.root.appendChild(badge);
    }
}
