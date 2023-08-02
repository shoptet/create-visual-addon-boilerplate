#!/usr/bin/env node
import { input, confirm, checkbox } from '@inquirer/prompts';
import fs from 'fs';
import PackageJson from '@npmcli/package-json';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const addonName = await input({ message: 'Enter the Addon name' });

const initExample = await confirm({
    message: 'Do you want to init with example?',
});

const initFolders = await checkbox({
    message: 'Do you want to init with folders?',
    choices: [
        // header, folder, orderFinale
        { name: 'header', value: 'header' },
        { name: 'footer', value: 'footer' },
        { name: 'orderFinale', value: 'orderFinale' },
    ],
});

const initBender = await confirm({
    message: 'Do you want to init with Shoptet Bender?',
});
let remoteEshopUrl = null;
if (initBender) {
    remoteEshopUrl = await input({
        message: 'Enter the eshop url',
    });
}

try {
    fs.mkdirSync(`./${addonName}`);
    fs.mkdirSync(`./${addonName}/src`);
    if (initFolders) {
        initFolders.forEach((folder) => {
            fs.mkdirSync(`./${addonName}/src/${folder}`);
        });
    }
    if (initExample) {
        fs.mkdirSync(`./${addonName}/dist`);
        fs.cpSync(`${__dirname}/.gitignore`, `./${addonName}/.gitignore`);
        fs.cpSync(`${__dirname}/template`, `./${addonName}`, {
            recursive: true,
        });
    }
    fs.cpSync(
        `${__dirname}/template/package.json`,
        `./${addonName}/package.json`
    );
} catch (err) {
    console.error(err);
    if (err.code !== 'EEXIST') throw err;
}

const addonPath = `./${addonName}/`;
const pkgJson = await PackageJson.load(addonPath);
pkgJson.update({
    name: addonName,
    devDependencies: {
        ...pkgJson.content.devDependencies,
        'shp-bender':
            'git+https://github.com/shoptet/shoptet-bender.git#addon-boilerplate',
    },
});

if (remoteEshopUrl) {
    pkgJson.update({
        scripts: {
            ...pkgJson.content.scripts,
            dev: `shp-bender --remote ${remoteEshopUrl}`,
        },
    });
}

pkgJson.normalize();
pkgJson.save();
