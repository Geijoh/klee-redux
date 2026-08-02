# Klee
A standalone Unreal Engine Blueprint visualizer for the web.

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
    } = event.detail;

    // assetName and objectPath are present for Material Function calls.
});
```

Every node activation includes `nodeName`, `nodeClass`, and `title`.
`expressionClass` is included for Material expression nodes, while `assetName`
and `objectPath` are included only when the node references a Material Function.
The exported `KLEE_NODE_ACTIVATE_EVENT` constant contains the event name.

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
