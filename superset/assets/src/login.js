var CryptoJS = require("crypto-js");
/**
 * apply onsubmit event for  login form to encrypt pwd before send in request
 */
$(document).ready(function () {
    var elements = document.getElementsByName('login');
    if (elements.length > 0 && elements[0].tagName.toLowerCase() == 'form') {
        document.getElementsByName('login')[0].addEventListener('submit', function (e) {
            var _k = CryptoJS.enc.Utf8.parse('qw34sd78fh67asb1');
            var _i = CryptoJS.lib.WordArray.random(16);
            var _m = document.getElementById('password').value;
            var _e = CryptoJS.AES.encrypt(_m, _k, {
                iv: _i
            });
            _e = _i.concat(_e.ciphertext).toString(CryptoJS.enc.Base64);
            document.getElementById('password').value = _e;
            return true;
        }, false);
    }

});