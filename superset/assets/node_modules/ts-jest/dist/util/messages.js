"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var Errors;
(function (Errors) {
    Errors["LoadingModuleFailed"] = "Loading module {{module}} failed with error: {{error}}";
    Errors["UnableToLoadOneModule"] = "Unable to load the module {{module}}. {{reason}} To fix it:\n{{fix}}";
    Errors["UnableToLoadAnyModule"] = "Unable to load any of these modules: {{module}}. {{reason}}. To fix it:\n{{fix}}";
    Errors["TypesUnavailableWithoutTypeCheck"] = "Type information is unavailable with \"isolatedModules\"";
    Errors["UnableToRequireDefinitionFile"] = "Unable to require `.d.ts` file.\nThis is usually the result of a faulty configuration or import. Make sure there is a `.js`, `.json` or another executable extension available alongside `{{file}}`.";
    Errors["FileNotFound"] = "File not found: {{inputPath}} (resolved as: {{resolvedPath}})";
    Errors["UntestedDependencyVersion"] = "Version {{actualVersion}} of {{module}} installed has not been tested with ts-jest. If you're experiencing issues, consider using a supported version ({{expectedVersion}}). Please do not report issues in ts-jest if you are using unsupported versions.";
    Errors["MissingDependency"] = "Module {{module}} is not installed. If you're experiencing issues, consider installing a supported version ({{expectedVersion}}).";
    Errors["UnableToCompileTypeScript"] = "TypeScript diagnostics ({{help}}):\n{{diagnostics}}";
    Errors["NotMappingMultiStarPath"] = "Not mapping \"{{path}}\" because it has more than one star (`*`).";
    Errors["NotMappingPathWithEmptyMap"] = "Not mapping \"{{path}}\" because it has no target.";
    Errors["MappingOnlyFirstTargetOfPath"] = "Mapping only to first target of \"{{path}}\" because it has more than one ({{count}}).";
    Errors["GotJsFileButAllowJsFalse"] = "Got a `.js` file to compile while `allowJs` option is not set to `true` (file: {{path}}). To fix this:\n  - if you want TypeScript to process JS files, set `allowJs` to `true` in your TypeScript config (usually tsconfig.json)\n  - if you do not want TypeScript to process your `.js` files, in your Jest config change the `transform` key which value is `ts-jest` so that it does not match `.js` files anymore";
    Errors["GotUnknownFileTypeWithoutBabel"] = "Got a unknown file type to compile (file: {{path}}). To fix this, in your Jest config change the `transform` key which value is `ts-jest` so that it does not match this kind of files anymore.";
    Errors["GotUnknownFileTypeWithBabel"] = "Got a unknown file type to compile (file: {{path}}). To fix this, in your Jest config change the `transform` key which value is `ts-jest` so that it does not match this kind of files anymore. If you still want Babel to process it, add another entry to the `transform` option with value `babel-jest` which key matches this type of files.";
    Errors["ConfigNoModuleInterop"] = "If you have issues related to imports, you should consider setting `esModuleInterop` to `true` in your TypeScript configuration file (usually `tsconfig.json`). See https://blogs.msdn.microsoft.com/typescript/2018/01/31/announcing-typescript-2-7/#easier-ecmascript-module-interoperability for more information.";
    Errors["UnableToFindProjectRoot"] = "Unable to find the root of the project where ts-jest has been installed.";
    Errors["UnableToResolveJestConfig"] = "Unable to resolve jest-config. Ensure Jest is properly installed.";
})(Errors = exports.Errors || (exports.Errors = {}));
var Helps;
(function (Helps) {
    Helps["FixMissingModule"] = "{{label}}: `npm i -D {{module}}` (or `yarn add --dev {{module}}`)";
    Helps["IgnoreDiagnosticCode"] = "customize using `[jest-config].globals.ts-jest.diagnostics` option";
    Helps["MigrateConfigUsingCLI"] = "Your Jest configuration is outdated. Use the CLI to help migrating it: ts-jest config:migrate <config-file>.";
})(Helps = exports.Helps || (exports.Helps = {}));
var Deprecateds;
(function (Deprecateds) {
    Deprecateds["EnvVar"] = "Using env. var \"{{old}}\" is deprecated, use \"{{new}}\" instead.";
    Deprecateds["ConfigOption"] = "\"[jest-config].{{oldPath}}\" is deprecated, use \"[jest-config].{{newPath}}\" instead.";
    Deprecateds["ConfigOptionWithNote"] = "\"[jest-config].{{oldPath}}\" is deprecated, use \"[jest-config].{{newPath}}\" instead.\n    \u21B3 {{note}}";
    Deprecateds["ConfigOptionUseBabelRcNote"] = "See `babel-jest` related issue: https://github.com/facebook/jest/issues/3845";
    Deprecateds["HelperMovedToUtils"] = "The `{{helper}}` helper has been moved to `ts-jest/utils`. Use `import { {{helper}} } from 'ts-jest/utils'` instead.";
})(Deprecateds = exports.Deprecateds || (exports.Deprecateds = {}));
var ImportReasons;
(function (ImportReasons) {
    ImportReasons["TsJest"] = "Using \"ts-jest\" requires this package to be installed.";
    ImportReasons["BabelJest"] = "Using \"babel-jest\" requires this package to be installed.";
})(ImportReasons = exports.ImportReasons || (exports.ImportReasons = {}));
function interpolate(msg, vars) {
    if (vars === void 0) { vars = {}; }
    return msg.replace(/\{\{([^\}]+)\}\}/g, function (_, key) { return (key in vars ? vars[key] : _); });
}
exports.interpolate = interpolate;
