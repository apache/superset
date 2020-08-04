module.exports = {
	root: true,
	plugins: ["node"],
	extends: ["../.eslintrc.js", "plugin:node/recommended"],
	env: {
		node: true,
		es6: true,
		jest: true
	},
	parserOptions: { ecmaVersion: 2017, sourceType: "module" },
	rules: {
		"node/no-unsupported-features": ["error", { version: 6 }],
		"node/no-deprecated-api": "error",
		"node/no-missing-import": "error",
		"node/no-missing-require": [
			"error",
			{
				resolvePaths: ["./packages"],
				allowModules: [
					"webpack",
					"@webpack-cli/generators",
					"@webpack-cli/init",
					"@webpack-cli/migrate",
					"@webpack-cli/utils",
					"@webpack-cli/generate-loader",
					"@webpack-cli/generate-plugin",
					"@webpack-cli/webpack-scaffold"
				]
			}
		],
		"node/no-unpublished-bin": "error",
		"node/no-unpublished-require": [
			"error",
			{
				allowModules: [
					"webpack",
					"webpack-dev-server",
					"@webpack-cli/generators",
					"@webpack-cli/init",
					"@webpack-cli/migrate",
					"@webpack-cli/utils",
					"@webpack-cli/generate-loader",
					"@webpack-cli/generate-plugin",
					"@webpack-cli/webpack-scaffold"
				]
			}
		],
		"node/no-extraneous-require": [
			"error",
			{
				allowModules: [
					"@webpack-cli/migrate",
					"@webpack-cli/generators",
					"@webpack-cli/utils",
					"@webpack-cli/generate-loader",
					"@webpack-cli/generate-plugin",
					"@webpack-cli/webpack-scaffold"
				]
			}
		],
		"node/process-exit-as-throw": "error"
	}
};
