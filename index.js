#!/usr/bin/env node
import { input, confirm } from '@inquirer/prompts';
import fs from 'fs';
import PackageJson from '@npmcli/package-json';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
console.log(__dirname);

const addonName = await input({ message: 'Enter the Addon name' });
const initExample = await confirm({
    message: 'Do you want to init with example?',
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
    if (initExample) {
        fs.cpSync(__dirname+'/template', `./${addonName}`, { recursive: true });
    } else {
        fs.mkdirSync(`./${addonName}`);
    }
} catch (err) {
    if (err.code !== 'EEXIST') throw err;
}

// add name and devDependecny to package.json using package-json
/*
    "name": "shoptet-${addonName}",
    "devDependencies": {
        "shp-bender": "git+https://github.com/shoptet/shoptet-bender.git"
    }
*/
const addonPath = `./${addonName}/`;
const pkgJson = await PackageJson.load(addonPath);
pkgJson.update({
    name: addonName,
    devDependencies: {
        ...pkgJson.content.devDependencies,
        'shp-bender': 'git+https://github.com/shoptet/shoptet-bender.git',
    },
});
if (remoteEshopUrl) {
    pkgJson.update({
        scripts: {
            'dev': `shp-bender --remote ${remoteEshopUrl}`,
        }
    });
}
pkgJson.normalize()
pkgJson.save();
