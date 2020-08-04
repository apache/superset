/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
"use strict";

const path = require("path");
const ParserHelpers = require("./ParserHelpers");
const ConstDependency = require("./dependencies/ConstDependency");

const NullFactory = require("./NullFactory");

class NodeStuffPlugin {
	constructor(options) {
		this.options = options;
	}

	apply(compiler) {
		const options = this.options;
		compiler.hooks.compilation.tap(
			"NodeStuffPlugin",
			(compilation, { normalModuleFactory }) => {
				compilation.dependencyFactories.set(ConstDependency, new NullFactory());
				compilation.dependencyTemplates.set(
					ConstDependency,
					new ConstDependency.Template()
				);

				const handler = (parser, parserOptions) => {
					if (parserOptions.node === false) return;

					let localOptions = options;
					if (parserOptions.node) {
						localOptions = Object.assign({}, localOptions, parserOptions.node);
					}

					const setConstant = (expressionName, value) => {
						parser.hooks.expression
							.for(expressionName)
							.tap("NodeStuffPlugin", () => {
								parser.state.current.addVariable(
									expressionName,
									JSON.stringify(value)
								);
								return true;
							});
					};

					const setModuleConstant = (expressionName, fn) => {
						parser.hooks.expression
							.for(expressionName)
							.tap("NodeStuffPlugin", () => {
								parser.state.current.addVariable(
									expressionName,
									JSON.stringify(fn(parser.state.module))
								);
								return true;
							});
					};
					const context = compiler.context;
					if (localOptions.__filename) {
						if (localOptions.__filename === "mock") {
							setConstant("__filename", "/index.js");
						} else {
							setModuleConstant("__filename", module =>
								path.relative(context, module.resource)
							);
						}
						parser.hooks.evaluateIdentifier
							.for("__filename")
							.tap("NodeStuffPlugin", expr => {
								if (!parser.state.module) return;
								const resource = parser.state.module.resource;
								const i = resource.indexOf("?");
								return ParserHelpers.evaluateToString(
									i < 0 ? resource : resource.substr(0, i)
								)(expr);
							});
					}
					if (localOptions.__dirname) {
						if (localOptions.__dirname === "mock") {
							setConstant("__dirname", "/");
						} else {
							setModuleConstant("__dirname", module =>
								path.relative(context, module.context)
							);
						}
						parser.hooks.evaluateIdentifier
							.for("__dirname")
							.tap("NodeStuffPlugin", expr => {
								if (!parser.state.module) return;
								return ParserHelpers.evaluateToString(
									parser.state.module.context
								)(expr);
							});
					}
					parser.hooks.expression
						.for("require.extensions")
						.tap(
							"NodeStuffPlugin",
							ParserHelpers.expressionIsUnsupported(
								parser,
								"require.extensions is not supported by webpack. Use a loader instead."
							)
						);
				};

				normalModuleFactory.hooks.parser
					.for("javascript/auto")
					.tap("NodeStuffPlugin", handler);
				normalModuleFactory.hooks.parser
					.for("javascript/dynamic")
					.tap("NodeStuffPlugin", handler);
			}
		);
	}
}
module.exports = NodeStuffPlugin;
