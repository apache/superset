"use strict";

function _v8flags() {
  const data = _interopRequireDefault(require("v8flags"));

  _v8flags = function () {
    return data;
  };

  return data;
}

function _path() {
  const data = _interopRequireDefault(require("path"));

  _path = function () {
    return data;
  };

  return data;
}

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

let args = [_path().default.join(__dirname, "_babel-node")];
let babelArgs = process.argv.slice(2);
let userArgs;
const argSeparator = babelArgs.indexOf("--");

if (argSeparator > -1) {
  userArgs = babelArgs.slice(argSeparator);
  babelArgs = babelArgs.slice(0, argSeparator);
}

function getNormalizedV8Flag(arg) {
  const matches = arg.match(/--(.+)/);

  if (matches) {
    return `--${matches[1].replace(/-/g, "_")}`;
  }

  return arg;
}

(0, _v8flags().default)(function (err, v8Flags) {
  babelArgs.forEach(function (arg, index) {
    const flag = arg.split("=")[0];

    switch (flag) {
      case "-d":
        args.unshift("--debug");
        break;

      case "debug":
      case "--debug":
      case "--debug-brk":
      case "--inspect":
      case "--inspect-brk":
      case "--experimental-modules":
        args.unshift(arg);
        break;

      case "-r":
      case "--require":
        args.push(flag);
        args.push(babelArgs[index + 1]);
        delete babelArgs[index + 1];
        break;

      case "-gc":
        args.unshift("--expose-gc");
        break;

      case "--nolazy":
        args.unshift(flag);
        break;

      default:
        if (v8Flags.indexOf(getNormalizedV8Flag(flag)) >= 0 || arg.indexOf("--trace") === 0) {
          args.unshift(arg);
        } else {
          args.push(arg);
        }

        break;
    }
  });

  if (argSeparator > -1) {
    args = args.concat(userArgs);
  }

  try {
    const kexec = require("kexec");

    kexec(process.argv[0], args);
  } catch (err) {
    if (err.code !== "MODULE_NOT_FOUND") throw err;

    const child_process = require("child_process");

    const proc = child_process.spawn(process.argv[0], args, {
      stdio: "inherit"
    });
    proc.on("exit", function (code, signal) {
      process.on("exit", function () {
        if (signal) {
          process.kill(process.pid, signal);
        } else {
          process.exit(code);
        }
      });
    });
    process.on("SIGINT", () => {
      proc.kill("SIGINT");
      process.exit(1);
    });
  }
});