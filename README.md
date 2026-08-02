# Klee: Redux
A standalone Unreal Engine Blueprint visualizer for the web, with some modifications to suit its use on my portfolio site: www.kris-j.com.

These modifications include:
*(This is still a work-in-progress. The following may change, shrink, or grow)*
* Editor-facing Node Names
* Ability to open referenced Material Functions
* Material graph inspection and Unreal-style preview-target selection *(pixel rendering is not included)*
* Node visuals that closer match the UE5 editor

## Material graphs

Klee accepts Unreal Material graph clipboard text, including the nested
`MaterialExpression` object blocks produced by the editor. Material nodes use
editor-facing captions when those values are serialized. This includes
parameter names, custom descriptions, common expression names, and the exact
asset name of a Material Function call. Unknown expression types receive a
readable title derived from their Unreal class name.

The Material Function call stores both the asset name and canonical Unreal
object path. The referenced function graph is not embedded in the parent
clipboard data; a host can use the activation event below to resolve and load a
separately supplied function graph.

### Graph inspection and authored Material settings

`display()` automatically classifies clipboard text as `blueprint`, `material`,
`material-function`, `material-fragment`, `mixed`, or `unknown`, and returns the
same inspection object exposed by `viewer.inspection`:

```js
const viewer = Klee.init(document.querySelector("canvas.klee"));
const inspection = viewer.display(source, {
    graph: {
        material: {
            domain: "MD_UI",
            blendMode: "BLEND_Translucent",
            shadingModel: "MSM_Unlit",
            useMaterialAttributes: false,
            unrealVersion: "5.7",
            // Optional exact editor-facing names; overrides built-in rules.
            rootInputs: ["Final Color", "Opacity"],
        },
    },
});
```

Klee prefers Material settings serialized in the pasted root/Material block,
records whether each value was `serialized`, `authored`, or `unknown`, and warns
when authored fallback metadata conflicts. Without an explicit `rootInputs`
list, Klee only filters root pins for a deliberately small, versioned set of
common UE5 UI-domain cases. Unsupported or incomplete metadata leaves the
serialized pins unchanged; Klee does not claim complete Unreal-version parity.

### Material preview targets

For a Material-family graph, select one Material node and press `W`, or use the
keyboard-operable **Preview** toolbar button, to mark it as the preview target.
Pressing `W` again returns to the Material root. With no selection, `W` clears an
active node preview; multiple selections do not change the active target.

```js
viewer.togglePreviewSelected();
viewer.clearPreview();
const state = viewer.getPreviewState();

canvas.addEventListener("klee:previewchange", event => {
    console.log(event.detail.nodeName, event.detail.reason);
});
```

The blue outline identifies the effective output target. This build does **not**
compile Unreal expressions or render Material pixels: inspection and preview
events explicitly report `pixelRenderingAvailable: false`, allowing a host to
provide an honest unavailable state or attach a compatible renderer.

## Node activation

Double-clicking a rendered node dispatches a bubbling, cancelable
`klee:nodeactivate` `CustomEvent` from the canvas. Its `detail` is a plain,
serializable object:

```js
const canvas = document.querySelector("canvas.klee");

canvas.addEventListener("klee:nodeactivate", (event) => {
    const {
        nodeName,
        nodeClass,
        title,
        expressionClass,
        assetName,
        objectPath,
        reference,
        references,
    } = event.detail;

    // reference is the first generic graph reference; references contains all.
    // Legacy assetName and objectPath remain for Material Function calls.
});
```

Every node activation includes `nodeName`, `nodeClass`, and `title`.
`expressionClass` is included for Material expression nodes, while `assetName`
and `objectPath` are included only when the node references a Material Function.
The exported `KLEE_NODE_ACTIVATE_EVENT` constant contains the event name.
Canvas nodes are not keyboard focus targets. Hosts that use node activation
must provide an equivalent keyboard-operable control, such as a list of linked
referenced graphs beside the canvas.

The generic `reference`/`references` contract covers Material Functions,
Blueprint function calls, Blueprint macros, and collapsed graphs. References
include the available asset path, graph/member name, GUID, self-context, and
whether they are built in or navigable. Native `/Script` calls are marked as
built-in and non-navigable; hosts should only open graph source that they have
explicitly mapped.

## Build minified JS
To build a minified JavaScript file of klee you have to install the development dependencies:
```bash
npm install
```

As soon as the dependencies are installed you can run the following command to build a minified JavaScript file.
```bash
npm run build
```

You can find the output at `dist/klee.min.js` relative to the root of the project directory.

## Build the website

To build the complete static website for deployment, run:

```bash
npm ci
npm run build:site
```

The deployable website is written to `site-dist/`. This build copies the site
from `docs/` and replaces `site-dist/js/klee.min.js` with the freshly compiled
library, so the deployed website cannot use a stale library bundle.

## Deploy to Hostinger from Git

The `Deploy Hostinger site` GitHub Actions workflow runs after every push to
`main`. It builds the complete website and publishes only the contents of
`site-dist/` to the `deploy` branch.

In Hostinger, connect the repository using **Advanced → Git**, select the
`deploy` branch, set the root directory to `public_html`, and enable automatic
deployment. Hostinger then receives a clean static site with `index.html` at
the branch root; source files and development dependencies are not published.

## Development setup

```bash
npm install
npm run dev
```
