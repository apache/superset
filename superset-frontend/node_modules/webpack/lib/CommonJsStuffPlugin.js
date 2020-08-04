/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
"use strict";

const path = require("path");
const ParserHelpers = require("./ParserHelpers");

class CommonJsStuffPlugin {
	apply(compiler) {
		compiler.hooks.compilation.tap(
			"CommonJsStuffPlugin",
			(compilation, { normalModuleFactory }) => {
				const handler = (parser, parserOptions) => {
					parser.hooks.expression
						.for("require.main.require")
						.tap(
							"CommonJsStuffPlugin",
							ParserHelpers.expressionIsUnsupported(
								parser,
								"require.main.require is not supported by webpack."
							)
						);
					parser.hooks.expression
						.for("module.parent.require")
						.tap(
							"CommonJsStuffPlugin",
							ParserHelpers.expressionIsUnsupported(
								parser,
								"module.parent.require is not supported by webpack."
							)
						);
					parser.hooks.expression
						.for("require.main")
						.tap(
							"CommonJsStuffPlugin",
							ParserHelpers.toConstantDependencyWithWebpackRequire(
								parser,
								"__webpack_require__.c[__webpack_require__.s]"
							)
						);
					parser.hooks.expression
						.for("module.loaded")
						.tap("CommonJsStuffPlugin", expr => {
							parser.state.module.buildMeta.moduleConcatenationBailout =
								"module.loaded";
							return ParserHelpers.toConstantDependency(
								parser,
								"module.l"
							)(expr);
						});
					parser.hooks.expression
						.for("module.id")
						.tap("CommonJsStuffPlugin", expr => {
							parser.state.module.buildMeta.moduleConcatenationBailout =
								"module.id";
							return ParserHelpers.toConstantDependency(
								parser,
								"module.i"
							)(expr);
						});
					parser.hooks.expression
						.for("module.exports")
						.tap("CommonJsStuffPlugin", () => {
							const module = parser.state.module;
							const isHarmony =
								module.buildMeta && module.buildMeta.exportsType;
							if (!isHarmony) return true;
						});
					parser.hooks.evaluateIdentifier
						.for("module.hot")
						.tap(
							"CommonJsStuffPlugin",
							ParserHelpers.evaluateToIdentifier("module.hot", false)
						);
					parser.hooks.expression
						.for("module")
						.tap("CommonJsStuffPlugin", () => {
							const module = parser.state.module;
							const isHarmony =
								module.buildMeta && module.buildMeta.exportsType;
							let moduleJsPath = path.join(
								__dirname,
								"..",
								"buildin",
								isHarmony ? "harmony-module.js" : "module.js"
							);
							if (module.context) {
								moduleJsPath = path.relative(
									parser.state.module.context,
									moduleJsPath
								);
								if (!/^[A-Z]:/i.test(moduleJsPath)) {
									moduleJsPath = `./${moduleJsPath.replace(/\\/g, "/")}`;
								}
							}
							return ParserHelpers.addParsedVariableToModule(
								parser,
								"module",
								`require(${JSON.stringify(moduleJsPath)})(module)`
							);
						});
				};

				normalModuleFactory.hooks.parser
					.for("javascript/auto")
					.tap("CommonJsStuffPlugin", handler);
				normalModuleFactory.hooks.parser
					.for("javascript/dynamic")
					.tap("CommonJsStuffPlugin", handler);
			}
		);
	}
}
module.exports = CommonJsStuffPlugin;
