module.exports = {
    output: {
        path: __dirname + '/',
        filename: 'bundle.js'
    },
    entry: [
        './src/examples'
    ],
    module: {
        loaders: [{
            test: /\.js$/,
            loaders: ['babel'],
            exclude: /node_modules/
        }]
    }
}
