# Start creating Shoptet Visual Addon in a minute

## Introduction

This repository contains a CLI wizard that scaffolds a Shoptet Visual Addon project, so you can start building visual addons and deploy them with a minimum of additional setup.

## Prerequisites

Before you can use create-visual-addon-boilerplate, you must have the following software installed on your system:

- **Node.js 24.15+ or 26+** (Node 25 is not supported) — you can download it from the official Node.js website: https://nodejs.org/
- **A package manager of your choice** — npm (bundled with Node.js), Yarn, or pnpm are all supported by the Addon Repository build pipeline.

## Usage

To create a new Visual Addon project, simply run the following command:

```
npx shoptet/create-visual-addon-boilerplate
```

This will launch a wizard that will guide you through the process of creating a new project. The wizard asks:

1. **Addon name** — used as the project folder and package name (lowercase letters, numbers, underscores, and hyphens, starting with a letter or a number).
2. **Addon description**
3. **Folders to initialize** — `header`, `footer`, and `orderFinale`; they correspond to the three code fields in the Shoptet administration.
4. **Example files** — pre-fills the selected folders with an example script and stylesheet (asked only when you selected some folders).
5. **Shoptet Bender** — adds [Shoptet Bender](https://github.com/shoptet/shoptet-bender) for local development against a live e-shop (you will be asked for the e-shop URL).
6. **Build process** — adds a webpack build pipeline (see [Build](#build) below).
7. **Stylesheet format** — CSS, LESS, or SCSS; example files follow the chosen format, and when you also choose the build process, only the matching preprocessor is installed (asked when you chose example files or the build process).

Once the wizard is complete, install the dependencies with your preferred package manager:

```
cd <addon-name>
npm install
```

**Commit the generated lockfile** (`package-lock.json`, `yarn.lock`, or `pnpm-lock.yaml`) — the Addon Repository deploy workflow detects your package manager from it and requires it for reproducible builds. You can also pin the manager explicitly via the [`packageManager`](https://nodejs.org/api/packages.html#packagemanager) field in `package.json`.

## Project structure

```
my-addon/
├─ src/
│  ├─ header/       # deployed to the "header" field in the administration
│  ├─ footer/       # deployed to the "footer" field
│  └─ orderFinale/  # deployed to the "order finale" field
├─ assets/          # optional static files (fonts, images), deployed as-is
├─ config.json      # Shoptet Bender configuration
├─ webpack.config.js # created when you choose the build process
└─ package.json
```

> In order to fully integrate with Addon Repository deployment, you cannot change the boilerplate folder structure.

## Development

If you chose Shoptet Bender, start the development server with:

```
npm run dev
```

Bender proxies the remote e-shop to http://localhost:3010 and injects your local scripts and styles into it, so you can develop against a live e-shop without touching production.

## Build

If you chose the build process, two scripts are available:

- `npm run build` — production build: bundles, minifies, and obfuscates your code into `dist/`, producing the exact artifacts the Addon Repository deploys (`scripts.<folder>.min.js`, `styles.<folder>.min.css`).
- `npm run build:dev` — development build of the same bundles without minification and obfuscation.

HTML files placed in the `src` folders are concatenated in alphabetical order into `dist/markups.<folder>.html` and deployed to the corresponding markup field. The `assets/` folder is copied to `dist/assets/` as-is.

Note that your code is bundled exactly as written — there is no transpilation or polyfilling, so mind the browser support of the JavaScript and CSS features you use.

The Addon Repository deploy workflow runs the `build` script with `--env production` using your detected package manager and uploads the contents of `dist/`, so a local production build gives you exactly what will be deployed.

## Shoptet Addon repository

Shoptet Addon repository is now under beta testing, contact husa@shoptet.cz if you want to try it.

## Contributing

If you find any issues or have any suggestions for improving this project, please feel free to open an issue or submit a pull request.
