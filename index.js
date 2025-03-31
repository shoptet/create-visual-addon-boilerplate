#!/usr/bin/env node

import { input, confirm, checkbox } from '@inquirer/prompts';
import fs from 'fs';
import PackageJson from '@npmcli/package-json';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const addonName = await input({
  message: 'Enter the Addon name',
  validate: input => {
    if (!input) {
      return 'Please enter a name';
    }
    if (input.match(/[^a-z0-9_-]/i)) {
      return 'Only letters, numbers, underscores, and hyphens are allowed';
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

const initExample = await confirm({
  message: 'Do you want to init with header include example?',
});

const initBender = await confirm({
  message: 'Do you want to init with Shoptet Bender?',
});

const initBuildTool = await confirm({
  message: 'Do you to init build process?',
});

let remoteEshopUrl = null;
if (initBender) {
  remoteEshopUrl = await input({
    message: 'Enter the eshop url',
    validate: input => {
      try {
        const url = new URL(input);
        if (url.protocol !== 'https:') {
          return 'Please enter a URL starting with https (e. g. https://classic.shoptet.cz)';
        }
        return true;
      } catch (err) {
        return 'Not a valid URL format (https://shoptet.cz)';
      }
    },
  });
}

try {
  fs.mkdirSync(`./${addonName}`);
  fs.mkdirSync(`./${addonName}/src`);
  if (initFolders) {
    initFolders.forEach(folder => {
      fs.mkdirSync(`./${addonName}/src/${folder}`);
      initExample &&
        (fs.writeFileSync(`./${addonName}/src/${folder}/script.js`, `console.log('Example script ${folder}');`),
        fs.writeFileSync(`./${addonName}/src/${folder}/style.less`, `/* Example style ${folder} */`));
    });
  }
  if (initExample) {
    fs.mkdirSync(`./${addonName}/dist`);
    fs.cpSync(`${__dirname}/template`, `./${addonName}`, {
      recursive: true,
    });
  }

  fs.cpSync(`${__dirname}/template/package.json`, `./${addonName}/package.json`);

  fs.cpSync(`${__dirname}/template/config.json`, `./${addonName}/config.json`);

  fs.cpSync(`${__dirname}/template/.gitignore`, `./${addonName}/.gitignore`);

  initBuildTool && fs.cpSync(`${__dirname}/template/webpack.config.js`, `./${addonName}/webpack.config.js`);

  fs.writeFileSync(`./${addonName}/yarn.lock`, '');

} catch (err) {
  console.error(err);
  if (err.code !== 'EEXIST') throw err;
}

const addonPath = `./${addonName}/`;
const pkgJson = await PackageJson.load(addonPath);

const webpackDep = {
  '@babel/core': '^7.24.1',
  '@babel/preset-env': '^7.24.1',
  'babel-loader': '^9.1.3',
  'css-loader': '^6.10.0',
  'css-minimizer-webpack-plugin': '^6.0.0',
  glob: '^10.3.10',
  'javascript-obfuscator': '^4.1.0',
  less: '^4.2.0',
  'less-loader': '^12.2.0',
  'mini-css-extract-plugin': '^2.8.0',
  path: '^0.12.7',
  sass: '^1.70.0',
  'sass-loader': '^14.1.0',
  'style-loader': '^3.3.4',
  webpack: '^5.90.1',
  'webpack-cli': '^5.1.4',
  'webpack-obfuscator': '^3.5.1',
  'webpack-remove-empty-scripts': '^1.0.4',
};
const benderDep = {
  'shp-bender': 'git+https://github.com/shoptet/shoptet-bender.git',
};

pkgJson.update({
  name: addonName,
  description: addonDescription,
  scripts: {
    ...(initBuildTool && { build: 'webpack --config webpack.config.js' }),
    ...(initBender && { dev: 'shp-bender' + (remoteEshopUrl ? ` --remote ${remoteEshopUrl}` : '') }),
  },
  devDependencies: {
    ...pkgJson.content.devDependencies,
    ...(initBuildTool && webpackDep),
    ...(initBender && benderDep),
  },
});
pkgJson.normalize();
pkgJson.save();
