'use strict';

const fs = require('fs');
const path = require('path');
const MemoryFileSystem = require('memory-fs');
const { colors } = require('webpack-log');
const NodeOutputFileSystem = require('webpack/lib/node/NodeOutputFileSystem');
const DevMiddlewareError = require('./DevMiddlewareError');

const { mkdirp } = new NodeOutputFileSystem();

module.exports = {
  toDisk(context) {
    const compilers = context.compiler.compilers || [context.compiler];
    for (const compiler of compilers) {
      compiler.hooks.afterEmit.tap('WebpackDevMiddleware', (compilation) => {
        const { assets } = compilation;
        const { log } = context;
        const { writeToDisk: filter } = context.options;
        let { outputPath } = compiler;

        if (outputPath === '/') {
          outputPath = compiler.context;
        }

        for (const assetPath of Object.keys(assets)) {
          const asset = assets[assetPath];
          const source = asset.source();
          const isAbsolute = path.isAbsolute(assetPath);
          const writePath = isAbsolute ? assetPath : path.join(outputPath, assetPath);
          const relativePath = path.relative(process.cwd(), writePath);
          const allowWrite = filter && typeof filter === 'function' ? filter(writePath) : true;

          if (allowWrite) {
            let output = source;

            mkdirp.sync(path.dirname(writePath));

            if (Array.isArray(source)) {
              output = source.join('\n');
            }

            try {
              fs.writeFileSync(writePath, output, 'utf-8');
              log.debug(colors.cyan(`Asset written to disk: ${relativePath}`));
            } catch (e) {
              log.error(`Unable to write asset to disk:\n${e}`);
            }
          }
        }
      });
    }
  },

  setFs(context, compiler) {
    if (typeof compiler.outputPath === 'string' && !path.posix.isAbsolute(compiler.outputPath) && !path.win32.isAbsolute(compiler.outputPath)) {
      throw new DevMiddlewareError('`output.path` needs to be an absolute path or `/`.');
    }

    let fileSystem;
    // store our files in memory
    const isMemoryFs = !compiler.compilers && compiler.outputFileSystem instanceof MemoryFileSystem;

    if (isMemoryFs) {
      fileSystem = compiler.outputFileSystem;
    } else {
      fileSystem = new MemoryFileSystem();
      compiler.outputFileSystem = fileSystem;
    }

    context.fs = fileSystem;
  }
};
