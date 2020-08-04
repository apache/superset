const webpack = require('webpack');
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const ExtractTextPlugin = require('extract-text-webpack-plugin');

module.exports = {
	context: path.resolve(__dirname, 'examples/src'),
	entry: {
		app: './app.js',
	},
	output: {
		path: path.resolve(__dirname, 'examples/dist'),
		filename: '[name].js',
		publicPath: '/',
	},
	devServer: {
		contentBase: path.resolve(__dirname, 'examples/src'),
		port: 8000,
	},
	module: {
		rules: [
			{
				test: /\.js$/,
				exclude: [/node_modules/],
				use: {
					loader: 'babel-loader',
				},
			},
			{
				test: /\.less$/,
				use: ExtractTextPlugin.extract({
					fallback: 'style-loader',
					use: ['css-loader', 'less-loader'],
				}),
			},
			{
				test: /\.html$/,
				use: [
					{
						loader: 'html-loader',
					},
				],
			},
		],
	},
	resolve: {
		alias: {
			'react-input-autosize': path.resolve(
				__dirname,
				'src/AutosizeInput'
			),
		},
	},
	plugins: [
		new webpack.optimize.CommonsChunkPlugin({
			name: 'common',
			filename: 'common.js',
			minChunk: 2,
		}),
		new HtmlWebpackPlugin({
			filename: 'index.html',
			inject: false,
			template: path.resolve(__dirname, 'examples/src/index.html'),
		}),
		new ExtractTextPlugin('example.css'),
	],
};
