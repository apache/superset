const NON_COMPILATION_ARGS = ["init", "migrate", "serve", "generate-loader", "generate-plugin", "info"];

const CONFIG_GROUP = "Config options:";
const BASIC_GROUP = "Basic options:";
const MODULE_GROUP = "Module options:";
const OUTPUT_GROUP = "Output options:";
const ADVANCED_GROUP = "Advanced options:";
const RESOLVE_GROUP = "Resolving options:";
const OPTIMIZE_GROUP = "Optimizing options:";
const DISPLAY_GROUP = "Stats options:";
const GROUPS = {
	CONFIG_GROUP,
	BASIC_GROUP,
	MODULE_GROUP,
	OUTPUT_GROUP,
	ADVANCED_GROUP,
	RESOLVE_GROUP,
	OPTIMIZE_GROUP,
	DISPLAY_GROUP
};

const WEBPACK_OPTIONS_FLAG = "WEBPACK_OPTIONS";

module.exports = {
	NON_COMPILATION_ARGS,
	GROUPS,
	WEBPACK_OPTIONS_FLAG
};
