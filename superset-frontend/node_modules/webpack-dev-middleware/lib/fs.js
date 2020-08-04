'use strict';

const fs = require('fs');
const path = require('path');

const MemoryFileSystem = require('memory-fs');
const mkdirp = require('mkdirp');
const { colors } = require('webpack-log');

const DevMiddlewareError = require('./DevMiddlewareError');

module.exports = {
  toDisk(context) {
    const compilers = context.compiler.compilers || [context.compiler];

    for (const compiler of compilers) {
      compiler.hooks.emit.tap('WebpackDevMiddleware', (compilation) => {
        if (compiler.hasWebpackDevMiddlewareAssetEmittedCallback) {
          return;
        }

        compiler.hooks.assetEmitted.tapAsync(
          'WebpackDevMiddleware',
          (file, info, callback) => {
            let targetPath = null;
            let content = null;

            // webpack@5
            if (info.compilation) {
              ({ targetPath, content } = info);
            } else {
              let targetFile = file;

              const queryStringIdx = targetFile.indexOf('?');

              if (queryStringIdx >= 0) {
                targetFile = targetFile.substr(0, queryStringIdx);
              }

              let { outputPath } = compiler;

              // TODO Why? Need remove in future major release
              if (outputPath === '/') {
                outputPath = compiler.context;
              }

              outputPath = compilation.getPath(outputPath, {});
              content = info;
              targetPath = path.join(outputPath, targetFile);
            }

            const { writeToDisk: filter } = context.options;
            const allowWrite =
              filter && typeof filter === 'function'
                ? filter(targetPath)
                : true;

            if (!allowWrite) {
              return callback();
            }

            const { log } = context;
            const dir = path.dirname(targetPath);

            return mkdirp(dir, (mkdirpError) => {
              if (mkdirpError) {
                return callback(mkdirpError);
              }

              return fs.writeFile(targetPath, content, (writeFileError) => {
                if (writeFileError) {
                  return callback(writeFileError);
                }

                log.debug(
                  colors.cyan(
                    `Asset written to disk: ${path.relative(
                      process.cwd(),
                      targetPath
                    )}`
                  )
                );

                return callback();
              });
            });
          }
        );
        compiler.hasWebpackDevMiddlewareAssetEmittedCallback = true;
      });
    }
  },

  setFs(context, compiler) {
    if (
      typeof compiler.outputPath === 'string' &&
      !path.posix.isAbsolute(compiler.outputPath) &&
      !path.win32.isAbsolute(compiler.outputPath)
    ) {
      throw new DevMiddlewareError(
        '`output.path` needs to be an absolute path or `/`.'
      );
    }

    let fileSystem;

    // store our files in memory
    const isConfiguredFs = context.options.fs;
    const isMemoryFs =
      !isConfiguredFs &&
      !compiler.compilers &&
      compiler.outputFileSystem instanceof MemoryFileSystem;

    if (isConfiguredFs) {
      // eslint-disable-next-line no-shadow
      const { fs } = context.options;

      if (typeof fs.join !== 'function') {
        // very shallow check
        throw new Error(
          'Invalid options: options.fs.join() method is expected'
        );
      }

      // eslint-disable-next-line no-param-reassign
      compiler.outputFileSystem = fs;
      fileSystem = fs;
    } else if (isMemoryFs) {
      fileSystem = compiler.outputFileSystem;
    } else {
      fileSystem = new MemoryFileSystem();

      // eslint-disable-next-line no-param-reassign
      compiler.outputFileSystem = fileSystem;
    }

    // eslint-disable-next-line no-param-reassign
    context.fs = fileSystem;
  },
};
