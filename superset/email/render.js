var system = require('system');
var args = system.args;

// Set credentials and paths
var endpoint = args[1];
var username = args[2];
var password = args[3];
var filename = args[4]

var page = require('webpage').create();

page.viewportSize = {
    width: 1920,
    height:1080
};

const BASE_URL = 'http://localhost:8088/';

page.open(BASE_URL + 'login/', function(status) {
    var csrf_token = page.evaluate(function () {
        return document.querySelector('#csrf_token').value;
    });

    // Login
    loginBody = 'username=' + username + '&password=' + password + '&csrf_token=' + csrf_token;
    page.open(BASE_URL + 'login/', 'POST', loginBody,  function () {

        // Navigate to a dashboard
        page.open(BASE_URL + endpoint, function() {
                setTimeout(function () {
                    page.render(filename);
                    phantom.exit();
                }, 5000);
        });
    });
});
