import { encryptText } from './utils/common';
/**
 * apply onsubmit event for  login form to encrypt pwd before send in request
 */
$(document).ready(function () {
    var elements = document.getElementsByName('login');
    if (elements.length > 0 && elements[0].tagName.toLowerCase() == 'form') {
        document.getElementsByName('login')[0].addEventListener('submit', function (e) {
            var _m = document.getElementById('password').value;
            document.getElementById('password').value = encryptText(_m);
            return true;
        }, false);
    }

});