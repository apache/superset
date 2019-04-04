module.exports = {
	context: __dirname,
	entry: "./test.js",
	module: {
		loaders: [
			{
				test: /test\.js$/,
				loader: __dirname + "/../cacheable?brfs"
			},
			{
				test: /\.coffee$/,
				loader: __dirname + "/../cacheable?coffeeify"
			}
		]
	}
}