#!/usr/bin/env node
import { input, confirm, checkbox } from '@inquirer/prompts';
import fs from 'fs';
import PackageJson from '@npmcli/package-json';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

//read until the validation for folder creation is ok
const addonName = await input({
    message: 'Enter the Addon name',
    validate: (input) => {
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
let remoteEshopUrl = null;
if (initBender) {
    remoteEshopUrl = await input({
        message: 'Enter the eshop url',
        validate: (input) => {
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
