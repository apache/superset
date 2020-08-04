"use strict";

var _v8flags = _interopRequireDefault(require("v8flags"));

var _path = _interopRequireDefault(require("path"));

var _nodeEnvironmentFlags = _interopRequireDefault(require("node-environment-flags"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

let args = [_path.default.join(__dirname, "_babel-node")];
let babelArgs = process.argv.slice(2);
let userArgs;
const argSeparator = babelArgs.indexOf("--");

if (argSeparator > -1) {
  userArgs = babelArgs.slice(argSeparator);
  babelArgs = babelArgs.slice(0, argSeparator);
}

function getNormalizedV8Flag(arg) {
  const matches = arg.match(/--(?:no)?(.+)/);

  if (matches) {
    return `--${matches[1].replace(/-/g, "_")}`;
  }

  return arg;
}

const aliases = new Map([["-d", "--debug"], ["-gc", "--expose-gc"]]);
(0, _v8flags.default)(function (err, v8Flags) {
  for (let i = 0; i < babelArgs.length; i++) {
    const arg = babelArgs[i];
    const flag = arg.split("=")[0];

    if (flag === "-r" || flag === "--require") {
      args.push(flag);
      args.push(babelArgs[++i]);
    } else if (aliases.has(flag)) {
      args.unshift(aliases.get(flag));
    } else if (flag === "debug" || flag === "inspect" || v8Flags.indexOf(getNormalizedV8Flag(flag)) >= 0 || _nodeEnvironmentFlags.default.has(flag)) {
      args.unshift(arg);
    } else {
      args.push(arg);
    }
  }

  if (argSeparator > -1) {
    args = args.concat(userArgs);
  }

  try {
    const kexec = require("kexec");

    kexec(process.argv[0], args);
  } catch (err) {
    if (err.code !== "MODULE_NOT_FOUND" && err.code !== "UNDECLARED_DEPENDENCY") {
      throw err;
    }

    const child_process = require("child_process");

    const proc = child_process.spawn(process.argv[0], args, {
      stdio: "inherit"
    });
    proc.on("exit", function (code, signal) {
      process.on("exit", function () {
        if (signal) {
          process.kill(process.pid, signal);
        } else {
          process.exitCode = code;
        }
      });
    });
    process.on("SIGINT", () => proc.kill("SIGINT"));
  }
});