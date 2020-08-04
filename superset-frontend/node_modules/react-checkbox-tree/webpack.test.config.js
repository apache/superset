const path = require('path');

module.exports = {
    mode: 'development',
    output: {
        filename: 'index.js',
        libraryTarget: 'umd',
        library: 'ReactCheckboxTree',
    },
    resolve: {
        alias: {
            'react-checkbox-tree': path.resolve(__dirname, 'src/js/CheckboxTree'),
        },
    },
    module: {
        rules: [
            {
                test: /\.js?$/,
                exclude: /(node_modules)/,
                loader: 'babel-loader',
            },
        ],
    },
};
