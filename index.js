#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Exit quietly instead of dumping a stack trace when the user aborts a prompt with Ctrl+C
process.on('uncaughtException', error => {
  if (error instanceof Error && error.name === 'ExitPromptError') {
    process.exit(130);
  }
  throw error;
});

// Mirrors the engines field; checked before the heavy dependencies load so
// unsupported Node versions get a readable error instead of a syntax error
const [nodeMajor, nodeMinor] = process.versions.node.split('.').map(Number);
if (!(nodeMajor >= 26 || (nodeMajor === 24 && nodeMinor >= 15))) {
  console.error(`This tool requires Node.js ^24.15.0 || >=26.0.0, you are running ${process.version}.`);
  process.exit(1);
}

const { input, confirm, checkbox, select } = await import('@inquirer/prompts');
const { default: PackageJson } = await import('@npmcli/package-json');

const addonName = await input({
  message: 'Enter the Addon name',
  validate: input => {
    if (!input) {
      return 'Please enter a name';
    }
    if (input.match(/[^a-z0-9_-]/)) {
      return 'Only lowercase letters, numbers, underscores, and hyphens are allowed';
    }
    if (fs.existsSync(`./${input}`)) {
      return 'Folder already exists';
    }
    return true;
  },
});

const addonDescription = await input({
  message: 'Enter the Addon description',
  validate: input => {
    if (!input) {
      return 'Please enter a description';
    }
    return true;
  },
});

const initFolders = await checkbox({
  message: 'Do you want to init with folders?',
  choices: [
    { name: 'header', value: 'header' },
    { name: 'footer', value: 'footer' },
    { name: 'orderFinale', value: 'orderFinale' },
  ],
});

let initExample = false;
if (initFolders.length > 0) {
  initExample = await confirm({
    message: 'Do you want to init the selected folders with example files?',
  });
}

const initBender = await confirm({
  message: 'Do you want to init with Shoptet Bender?',
});

let remoteEshopUrl = null;
if (initBender) {
  const eshopUrl = await input({
    message: 'Enter the eshop url',
    validate: input => {
      try {
        const url = new URL(input);
        if (url.protocol !== 'https:') {
          return 'Please enter a URL starting with https (e.g. https://classic.shoptet.cz)';
        }
        return true;
      } catch (err) {
        return 'Not a valid URL format (https://shoptet.cz)';
      }
    },
  });
  remoteEshopUrl = new URL(eshopUrl).origin;
}

const initBuildTool = await confirm({
  message: 'Do you want to init the build process?',
});

let styleFormat = 'css';
if (initExample || initBuildTool) {
  styleFormat = await select({
    message: 'Which stylesheet format do you want to use?',
    choices: [
      { name: 'CSS', value: 'css' },
      { name: 'LESS', value: 'less' },
      { name: 'SCSS (Sass)', value: 'scss' },
    ],
  });
}

try {
  fs.mkdirSync(`./${addonName}`);
  fs.mkdirSync(`./${addonName}/src`);

  initFolders.forEach(folder => {
    fs.mkdirSync(`./${addonName}/src/${folder}`);
    if (initExample) {
      fs.writeFileSync(`./${addonName}/src/${folder}/script.js`, `console.log('Example script ${folder}');`);
      fs.writeFileSync(`./${addonName}/src/${folder}/style.${styleFormat}`, `/* Example style ${folder} */`);
    }
  });

  fs.copyFileSync(`${__dirname}/template/package.json`, `./${addonName}/package.json`);

  if (initBender) {
    // config.json is read by Shoptet Bender from the project root
    fs.copyFileSync(`${__dirname}/template/config.json`, `./${addonName}/config.json`);
  }

  if (initBuildTool) {
    fs.copyFileSync(`${__dirname}/template/webpack.config.js`, `./${addonName}/webpack.config.js`);
  }

  // Written manually because npm pack excludes .gitignore files from the published package
  fs.writeFileSync(`./${addonName}/.gitignore`, 'node_modules/\ndist/\n');
} catch (err) {
  console.error('Failed to create the project files:', err);
  process.exit(1);
}

const addonPath = `./${addonName}/`;
const pkgJson = await PackageJson.load(addonPath);

const webpackDep = {
  'copy-webpack-plugin': '^14.0.0',
  'css-loader': '^7.1.4',
  'css-minimizer-webpack-plugin': '^8.0.0',
  glob: '^13.0.6',
  'javascript-obfuscator': '^5.5.0',
  'mini-css-extract-plugin': '^2.10.2',
  'terser-webpack-plugin': '^5.6.1',
  webpack: '^5.109.2',
  'webpack-cli': '^7.2.2',
  'webpack-obfuscator': '^3.6.1',
  'webpack-remove-empty-scripts': '^1.1.1',
};
const styleDep = {
  css: {},
  less: { less: '^4.8.1', 'less-loader': '^13.0.0' },
  scss: { sass: '^1.102.0', 'sass-loader': '^17.0.0' },
};
const benderDep = {
  'shp-bender': 'git+https://github.com/shoptet/shoptet-bender.git',
};

pkgJson.update({
  name: addonName,
  description: addonDescription,
  scripts: {
    ...(initBuildTool && { build: 'webpack --env production', 'build:dev': 'webpack' }),
    ...(initBender && { dev: `shp-bender --remote ${remoteEshopUrl}` }),
  },
  devDependencies: {
    ...pkgJson.content.devDependencies,
    ...(initBuildTool && webpackDep),
    ...(initBuildTool && styleDep[styleFormat]),
    ...(initBender && benderDep),
  },
});
await pkgJson.save();

console.log(`\nDone! Next steps:`);
console.log(`  cd ${addonName}`);
console.log(`  npm install`);
if (initBender) {
  console.log(`  npm run dev`);
}
if (initBuildTool) {
  console.log(`  npm run build`);
}
console.log(`\nThe examples use npm, but any package manager works — remember to commit its lockfile.`);
if (initExample && !initBuildTool && styleFormat !== 'css') {
  console.log(
    `\nNote: you chose ${styleFormat.toUpperCase()} example files without the build process — you will need your own tooling to compile them.`
  );
}
