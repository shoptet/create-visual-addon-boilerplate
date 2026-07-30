/** @format */

import fs from 'fs';
import path from 'path';
import { globSync } from 'glob';
import CopyPlugin from 'copy-webpack-plugin';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import CssMinimizerPlugin from 'css-minimizer-webpack-plugin';
import TerserPlugin from 'terser-webpack-plugin';
import WebpackObfuscatorPlugin from 'webpack-obfuscator';
import RemoveEmptyScriptsPlugin from 'webpack-remove-empty-scripts';

const outputDir = path.resolve(process.cwd(), 'dist');

// The three folders correspond to the code fields in the Shoptet administration
const folders = ['header', 'footer', 'orderFinale'];

const extensionsFilenames = {
  js: 'scripts',
  scss: 'styles',
  less: 'styles',
  css: 'styles',
};

const getEntries = (extension, isProduction) => {
  const entries = {};
  folders.forEach(folder => {
    const files = globSync(`./src/${folder}/**/*.${extension}`).sort();
    if (files.length > 0) {
      const foundExtension = files[0].split('.').pop();
      const filename = extensionsFilenames[foundExtension];
      const minExtension = isProduction ? '.min' : '';
      entries[`${filename}.${folder}${minExtension}`] = files.map(str => './' + str);
    }
  });
  return entries;
};

// The Addon Repository deployment reads markup as `markups.<folder>.html`
// (no `.min` suffix), concatenated from all HTML files in the folder in
// alphabetical order.
class MarkupPlugin {
  apply(compiler) {
    compiler.hooks.thisCompilation.tap('MarkupPlugin', compilation => {
      compilation.hooks.processAssets.tap(
        { name: 'MarkupPlugin', stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL },
        () => {
          folders.forEach(folder => {
            const folderPath = path.resolve('src', folder);
            if (fs.existsSync(folderPath)) {
              compilation.contextDependencies.add(folderPath);
            }
            const files = globSync(`./src/${folder}/**/*.html`).sort();
            if (files.length > 0) {
              files.forEach(file => compilation.fileDependencies.add(path.resolve(file)));
              const markup = files.map(file => fs.readFileSync(file, 'utf8')).join('\n');
              compilation.emitAsset(`markups.${folder}.html`, new compiler.webpack.sources.RawSource(markup));
            }
          });
        }
      );
    });
  }
}

export default env => {
  const isProduction = env.production === true;
  return {
    mode: isProduction ? 'production' : 'development',
    devtool: isProduction ? false : 'eval',
    // Floor for webpack-generated runtime code. Source files are bundled as
    // written — there is no transpilation, mind your browser support.
    target: ['web', 'es2017'],
    entry: {
      ...getEntries('js', isProduction),
      ...getEntries('{scss,less,css}', isProduction),
      // TODO: add TS entries
    },
    output: {
      path: outputDir,
      clean: true,
    },
    plugins: [
      new MiniCssExtractPlugin(),
      new RemoveEmptyScriptsPlugin(),
      new MarkupPlugin(),
      // The assets folder is deployed to the remote assets folder as-is
      new CopyPlugin({ patterns: [{ from: 'assets', to: 'assets', noErrorOnMissing: true }] }),
    ],
    ...(isProduction && {
      optimization: {
        minimize: true,
        minimizer: [
          // Explicit TerserPlugin: a custom minimizer array would otherwise drop
          // webpack's default JS minification. extractComments: false keeps
          // license banners inline instead of emitting extra *.LICENSE.txt
          // files into dist/, which is deployed as a whole.
          new TerserPlugin({ extractComments: false }),
          new WebpackObfuscatorPlugin(),
          new CssMinimizerPlugin(),
        ],
      },
    }),
    module: {
      rules: [
        // The less/scss rules only work when the corresponding preprocessor is
        // installed (less + less-loader, or sass + sass-loader)
        {
          test: /\.less$/i,
          use: [MiniCssExtractPlugin.loader, 'css-loader', 'less-loader'],
        },
        {
          test: /\.scss$/i,
          use: [MiniCssExtractPlugin.loader, 'css-loader', 'sass-loader'],
        },
        {
          test: /\.css$/,
          use: [MiniCssExtractPlugin.loader, 'css-loader'],
        },
        {
          test: /\.(png|jpe?g|gif|svg|woff2?|ttf|eot)$/,
          type: 'asset/resource',
          generator: {
            filename: 'assets/[name][ext]',
          },
        },
      ],
    },
  };
};
