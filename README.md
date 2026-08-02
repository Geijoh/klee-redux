# Klee: Redux
A standalone Unreal Engine Blueprint visualizer for the web, with some modifications to suit its use on my portfolio site: www.kris-j.com.

These modifications include:
*(This is still a work-in-progress. The following may change, shrink, or grow)*
* Editor-facing Node Names
* Ability to open referenced Material Functions
* Ability to preview Material, with a defined texture *(if Texture Sample nodes are present)*
* Node visuals that closer match the UE5 editor

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
