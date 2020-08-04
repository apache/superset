'use strict';

var WhooTS = require('./');
var http = require('http');
var url = require('url');

var PORT = 8080;

// valid requests look like:
// http://localhost:8080/tms/{z}/{x}/{y}/{layer}/{baseUrl}
// http://localhost:8080/tms/19/154308/197167/Natural2015/http://geodata.state.nj.us/imagerywms/Natural2015
function handleRequest(request, response) {
    var pathname = url.parse(request.url, true).pathname;
    var params = pathname.split('/');

    if (params.length > 6 && params[1].toLowerCase() === 'tms') {
        var z = +params[2],
            x = +params[3],
            y = +params[4],
            layer = params[5],
            baseUrl = pathname.replace(params.slice(0,6).join('/') + '/', '');

        if (!isNaN(z) && !isNaN(x) && !isNaN(y) && layer && url.parse(baseUrl).protocol) {
            response.writeHead(302, { 'Location': WhooTS.getURL(baseUrl, layer, x, y, z) });
            response.end('Redirect');
            return;
        }
    }

    response.statusCode = '404';
    response.end('Not Found');
}


var server = http.createServer(handleRequest);
server.listen(PORT, function() {
    /* eslint-disable no-console */
    console.log('Server listening on: http://localhost:%s', PORT);
    /* eslint-enable no-console */
});
