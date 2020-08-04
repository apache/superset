"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = parseArgv;

function _fs() {
  const data = _interopRequireDefault(require("fs"));

  _fs = function () {
    return data;
  };

  return data;
}

function _commander() {
  const data = _interopRequireDefault(require("commander"));

  _commander = function () {
    return data;
  };

  return data;
}

function _core() {
  const data = require("@babel/core");

  _core = function () {
    return data;
  };

  return data;
}

function _uniq() {
  const data = _interopRequireDefault(require("lodash/uniq"));

  _uniq = function () {
    return data;
  };

  return data;
}

function _glob() {
  const data = _interopRequireDefault(require("glob"));

  _glob = function () {
    return data;
  };

  return data;
}

var _package = _interopRequireDefault(require("../../package.json"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

_commander().default.option("-f, --filename [filename]", "The filename to use when reading from stdin. This will be used in source-maps, errors etc.");

_commander().default.option("--presets [list]", "A comma-separated list of preset names.", collect);

_commander().default.option("--plugins [list]", "A comma-separated list of plugin names.", collect);

_commander().default.option("--config-file [path]", "Path to a .babelrc file to use.");

_commander().default.option("--env-name [name]", "The name of the 'env' to use when loading configs and plugins. " + "Defaults to the value of BABEL_ENV, or else NODE_ENV, or else 'development'.");

_commander().default.option("--root-mode [mode]", "The project-root resolution mode. " + "One of 'root' (the default), 'upward', or 'upward-optional'.");

_commander().default.option("--source-type [script|module]", "");

_commander().default.option("--no-babelrc", "Whether or not to look up .babelrc and .babelignore files.");

_commander().default.option("--ignore [list]", "List of glob paths to **not** compile.", collect);

_commander().default.option("--only [list]", "List of glob paths to **only** compile.", collect);

_commander().default.option("--no-highlight-code", "Enable or disable ANSI syntax highlighting of code frames. (on by default)");

_commander().default.option("--no-comments", "Write comments to generated output. (true by default)");

_commander().default.option("--retain-lines", "Retain line numbers. This will result in really ugly code.");

_commander().default.option("--compact [true|false|auto]", "Do not include superfluous whitespace characters and line terminators.", booleanify);

_commander().default.option("--minified", "Save as many bytes when printing. (false by default)");

_commander().default.option("--auxiliary-comment-before [string]", "Print a comment before any injected non-user code.");

_commander().default.option("--auxiliary-comment-after [string]", "Print a comment after any injected non-user code.");

_commander().default.option("-s, --source-maps [true|false|inline|both]", "", booleanify);

_commander().default.option("--source-map-target [string]", "Set `file` on returned source map.");

_commander().default.option("--source-file-name [string]", "Set `sources[0]` on returned source map.");

_commander().default.option("--source-root [filename]", "The root from which all sources are relative.");

_commander().default.option("--module-root [filename]", "Optional prefix for the AMD module formatter that will be prepended to the filename on module definitions.");

_commander().default.option("-M, --module-ids", "Insert an explicit id for modules.");

_commander().default.option("--module-id [string]", "Specify a custom name for module ids.");

_commander().default.option("-x, --extensions [extensions]", "List of extensions to compile when a directory has been the input. [.es6,.js,.es,.jsx,.mjs]", collect);

_commander().default.option("--keep-file-extension", "Preserve the file extensions of the input files.");

_commander().default.option("-w, --watch", "Recompile files on changes.");

_commander().default.option("--skip-initial-build", "Do not compile files before watching.");

_commander().default.option("-o, --out-file [out]", "Compile all input files into a single file.");

_commander().default.option("-d, --out-dir [out]", "Compile an input directory of modules into an output directory.");

_commander().default.option("--relative", "Compile into an output directory relative to input directory or file. Requires --out-dir [out]");

_commander().default.option("-D, --copy-files", "When compiling a directory copy over non-compilable files.");

_commander().default.option("--include-dotfiles", "Include dotfiles when compiling and copying non-compilable files.");

_commander().default.option("--no-copy-ignored", "Exclude ignored files when copying non-compilable files.");

_commander().default.option("--verbose", "Log everything. This option conflicts with --quiet");

_commander().default.option("--quiet", "Don't log anything. This option conflicts with --verbose");

_commander().default.option("--delete-dir-on-start", "Delete the out directory before compilation.");

_commander().default.option("--out-file-extension [string]", "Use a specific extension for the output files");

_commander().default.version(_package.default.version + " (@babel/core " + _core().version + ")");

_commander().default.usage("[options] <files ...>");

_commander().default.action(() => {});

function parseArgv(args) {
  _commander().default.parse(args);

  const errors = [];

  let filenames = _commander().default.args.reduce(function (globbed, input) {
    let files = _glob().default.sync(input);

    if (!files.length) files = [input];
    return globbed.concat(files);
  }, []);

  filenames = (0, _uniq().default)(filenames);
  filenames.forEach(function (filename) {
    if (!_fs().default.existsSync(filename)) {
      errors.push(filename + " does not exist");
    }
  });

  if (_commander().default.outDir && !filenames.length) {
    errors.push("--out-dir requires filenames");
  }

  if (_commander().default.outFile && _commander().default.outDir) {
    errors.push("--out-file and --out-dir cannot be used together");
  }

  if (_commander().default.relative && !_commander().default.outDir) {
    errors.push("--relative requires --out-dir usage");
  }

  if (_commander().default.watch) {
    if (!_commander().default.outFile && !_commander().default.outDir) {
      errors.push("--watch requires --out-file or --out-dir");
    }

    if (!filenames.length) {
      errors.push("--watch requires filenames");
    }
  }

  if (_commander().default.skipInitialBuild && !_commander().default.watch) {
    errors.push("--skip-initial-build requires --watch");
  }

  if (_commander().default.deleteDirOnStart && !_commander().default.outDir) {
    errors.push("--delete-dir-on-start requires --out-dir");
  }

  if (_commander().default.verbose && _commander().default.quiet) {
    errors.push("--verbose and --quiet cannot be used together");
  }

  if (!_commander().default.outDir && filenames.length === 0 && typeof _commander().default.filename !== "string" && _commander().default.babelrc !== false) {
    errors.push("stdin compilation requires either -f/--filename [filename] or --no-babelrc");
  }

  if (_commander().default.keepFileExtension && _commander().default.outFileExtension) {
    errors.push("--out-file-extension cannot be used with --keep-file-extension");
  }

  if (errors.length) {
    console.error("babel:");
    errors.forEach(function (e) {
      console.error("  " + e);
    });
    return null;
  }

  const opts = _commander().default.opts();

  const babelOptions = {
    presets: opts.presets,
    plugins: opts.plugins,
    rootMode: opts.rootMode,
    configFile: opts.configFile,
    envName: opts.envName,
    sourceType: opts.sourceType,
    ignore: opts.ignore,
    only: opts.only,
    retainLines: opts.retainLines,
    compact: opts.compact,
    minified: opts.minified,
    auxiliaryCommentBefore: opts.auxiliaryCommentBefore,
    auxiliaryCommentAfter: opts.auxiliaryCommentAfter,
    sourceMaps: opts.sourceMaps,
    sourceFileName: opts.sourceFileName,
    sourceRoot: opts.sourceRoot,
    moduleRoot: opts.moduleRoot,
    moduleIds: opts.moduleIds,
    moduleId: opts.moduleId,
    babelrc: opts.babelrc === true ? undefined : opts.babelrc,
    highlightCode: opts.highlightCode === true ? undefined : opts.highlightCode,
    comments: opts.comments === true ? undefined : opts.comments
  };

  for (const key of Object.keys(babelOptions)) {
    if (babelOptions[key] === undefined) {
      delete babelOptions[key];
    }
  }

  return {
    babelOptions,
    cliOptions: {
      filename: opts.filename,
      filenames,
      extensions: opts.extensions,
      keepFileExtension: opts.keepFileExtension,
      outFileExtension: opts.outFileExtension,
      watch: opts.watch,
      skipInitialBuild: opts.skipInitialBuild,
      outFile: opts.outFile,
      outDir: opts.outDir,
      relative: opts.relative,
      copyFiles: opts.copyFiles,
      copyIgnored: opts.copyFiles && opts.copyIgnored,
      includeDotfiles: opts.includeDotfiles,
      verbose: opts.verbose,
      quiet: opts.quiet,
      deleteDirOnStart: opts.deleteDirOnStart,
      sourceMapTarget: opts.sourceMapTarget
    }
  };
}

function booleanify(val) {
  if (val === "true" || val == 1) {
    return true;
  }

  if (val === "false" || val == 0 || !val) {
    return false;
  }

  return val;
}

function collect(value, previousValue) {
  if (typeof value !== "string") return previousValue;
  const values = value.split(",");
  return previousValue ? previousValue.concat(values) : values;
}