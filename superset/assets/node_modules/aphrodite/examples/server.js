import fs from 'fs';
import path from 'path';
import express from 'express';
import webpack from 'webpack';
import webpackMiddleware from 'webpack-dev-middleware';
import config from './webpack.config.js';

import examplesSSR from './src/examples-ssr.js';

const port = 4114;
const app = express();

const compiler = webpack(config);
const middleware = webpackMiddleware(compiler, {
    publicPath: config.output.publicPath,
    contentBase: 'src',
    stats: {
        colors: true,
        hash: false,
        timings: true,
        chunks: false,
        chunkModules: false,
        modules: false
    }
});

app.use(middleware);
app.get('/', function(req, res) {
    res.write(fs.readFileSync(path.join(__dirname, 'index.html')));
    res.end();
});
app.get('/ssr/', function(req, res) {
    res.write(examplesSSR());
    res.end();
});

app.listen(port, '0.0.0.0', function(err) {
    if (err) {
        console.log(err);
    }
    console.info('==> Listening on port %s. Visit http://localhost:%s/ and http://localhost:%s/ssr in your browser.', port, port, port);
});
