/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
"use strict";

const NodeWatchFileSystem = require("./NodeWatchFileSystem");
const NodeOutputFileSystem = require("./NodeOutputFileSystem");
const NodeJsInputFileSystem = require("enhanced-resolve/lib/NodeJsInputFileSystem");
const CachedInputFileSystem = require("enhanced-resolve/lib/CachedInputFileSystem");
const createConsoleLogger = require("../logging/createConsoleLogger");
const nodeConsole = require("./nodeConsole");

class NodeEnvironmentPlugin {
	constructor(options) {
		this.options = options || {};
	}

	apply(compiler) {
		compiler.infrastructureLogger = createConsoleLogger(
			Object.assign(
				{
					level: "info",
					debug: false,
					console: nodeConsole
				},
				this.options.infrastructureLogging
			)
		);
		compiler.inputFileSystem = new CachedInputFileSystem(
			new NodeJsInputFileSystem(),
			60000
		);
		const inputFileSystem = compiler.inputFileSystem;
		compiler.outputFileSystem = new NodeOutputFileSystem();
		compiler.watchFileSystem = new NodeWatchFileSystem(
			compiler.inputFileSystem
		);
		compiler.hooks.beforeRun.tap("NodeEnvironmentPlugin", compiler => {
			if (compiler.inputFileSystem === inputFileSystem) inputFileSystem.purge();
		});
	}
}
module.exports = NodeEnvironmentPlugin;
