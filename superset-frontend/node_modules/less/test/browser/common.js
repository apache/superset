/* Add js reporter for sauce */
jasmine.getEnv().addReporter(new jasmine.JSReporter2());
jasmine.getEnv().defaultTimeoutInterval = 3000;

// From https://github.com/axemclion/grunt-saucelabs/issues/109#issuecomment-166767282
// (function () {
//     var oldJSReport = window.jasmine.getJSReport;
//     window.jasmine.getJSReport = function () {
//         var results = oldJSReport();
//         if (results) {
//             return {
//                 durationSec: results.durationSec,
//                 suites: removePassingTests(results.suites),
//                 passed: results.passed
//             };
//         } else {
//             return null;
//         }
//     };

//     function removePassingTests (suites) {
//         return suites.filter(specFailed)
//             .map(mapSuite);
//     }

//     function mapSuite (suite) {
//         var result = {};
//         for (var s in suite) {
//             result[s] = suite[s];
//         }
//         result.specs = suite.specs.filter(specFailed);
//         result.suites = removePassingTests(suite.suites);
//         return result;
//     }

//     function specFailed (item) {
//         return !item.passed;
//     }
// })();
/* record log messages for testing */

var logMessages = [];
window.less = window.less || {};

var logLevel_debug = 4,
    logLevel_info = 3,
    logLevel_warn = 2,
    logLevel_error = 1;

// The amount of logging in the javascript console.
// 3 - Debug, information and errors
// 2 - Information and errors
// 1 - Errors
// 0 - None
// Defaults to 2

less.loggers = [
    {
        debug: function(msg) {
            if (less.options.logLevel >= logLevel_debug) {
                logMessages.push(msg);
            }
        },
        info: function(msg) {
            if (less.options.logLevel >= logLevel_info) {
                logMessages.push(msg);
            }
        },
        warn: function(msg) {
            if (less.options.logLevel >= logLevel_warn) {
                logMessages.push(msg);
            }
        },
        error: function(msg) {
            if (less.options.logLevel >= logLevel_error) {
                logMessages.push(msg);
            }
        }
    }
];

testLessEqualsInDocument = function () {
    testLessInDocument(testSheet);
};

testLessErrorsInDocument = function (isConsole) {
    testLessInDocument(isConsole ? testErrorSheetConsole : testErrorSheet);
};

testLessInDocument = function (testFunc) {
    var links = document.getElementsByTagName('link'),
        typePattern = /^text\/(x-)?less$/;

    for (var i = 0; i < links.length; i++) {
        if (links[i].rel === 'stylesheet/less' || (links[i].rel.match(/stylesheet/) &&
            (links[i].type.match(typePattern)))) {
            testFunc(links[i]);
        }
    }
};

ieFormat = function(text) {
    var styleNode = document.createElement('style');
    styleNode.setAttribute('type', 'text/css');
    var headNode = document.getElementsByTagName('head')[0];
    headNode.appendChild(styleNode);
    try {
        if (styleNode.styleSheet) {
            styleNode.styleSheet.cssText = text;
        } else {
            styleNode.innerText = text;
        }
    } catch (e) {
        throw new Error('Couldn\'t reassign styleSheet.cssText.');
    }
    var transformedText = styleNode.styleSheet ? styleNode.styleSheet.cssText : styleNode.innerText;
    headNode.removeChild(styleNode);
    return transformedText;
};

testSheet = function (sheet) {
    it(sheet.id + ' should match the expected output', function (done) {
        var lessOutputId = sheet.id.replace('original-', ''),
            expectedOutputId = 'expected-' + lessOutputId,
            lessOutputObj,
            lessOutput,
            expectedOutputHref = document.getElementById(expectedOutputId).href,
            expectedOutput = loadFile(expectedOutputHref);

        // Browser spec generates less on the fly, so we need to loose control
        less.pageLoadFinished
            .then(function () {
                lessOutputObj = document.getElementById(lessOutputId);
                lessOutput = lessOutputObj.styleSheet ? lessOutputObj.styleSheet.cssText :
                    (lessOutputObj.innerText || lessOutputObj.innerHTML);

                expectedOutput
                    .then(function (text) {
                        if (window.navigator.userAgent.indexOf('MSIE') >= 0 ||
                            window.navigator.userAgent.indexOf('Trident/') >= 0) {
                            text = ieFormat(text);
                        }
                        expect(lessOutput).toEqual(text);
                        done();
                    });
            });
    });
};

// TODO: do it cleaner - the same way as in css

function extractId(href) {
    return href.replace(/^[a-z-]+:\/+?[^\/]+/i, '') // Remove protocol & domain
        .replace(/^\//, '') // Remove root /
        .replace(/\.[a-zA-Z]+$/, '') // Remove simple extension
        .replace(/[^\.\w-]+/g, '-') // Replace illegal characters
        .replace(/\./g, ':'); // Replace dots with colons(for valid id)
}

waitFor = function (waitFunc) {
    return new Promise(function (resolve) {
        var timeoutId = setInterval(function () {
            if (waitFunc()) {
                clearInterval(timeoutId);
                resolve();
            }
        }, 5);
    });
};

testErrorSheet = function (sheet) {
    it(sheet.id + ' should match an error', function (done) {
        var lessHref = sheet.href,
            id = 'less-error-message:' + extractId(lessHref),
            errorHref = lessHref.replace(/.less$/, '.txt'),
            errorFile = loadFile(errorHref),
            actualErrorElement,
            actualErrorMsg;

        // Less.js sets 10ms timer in order to add error message on top of page.
        waitFor(function () {
            actualErrorElement = document.getElementById(id);
            return actualErrorElement !== null;
        }).then(function () {
            var innerText = (actualErrorElement.innerHTML
                        .replace(/<h3>|<\/?p>|<a href="[^"]*">|<\/a>|<ul>|<\/?pre( class="?[^">]*"?)?>|<\/li>|<\/?label>/ig, '')
                        .replace(/<\/h3>/ig, ' ')
                        .replace(/<li>|<\/ul>|<br>/ig, '\n'))
                        .replace(/&amp;/ig, '&')
                        // for IE8
                        .replace(/\r\n/g, '\n')
                        .replace(/\. \nin/, '. in');
            actualErrorMsg = innerText
                    .replace(/\n\d+/g, function (lineNo) {
                        return lineNo + ' ';
                    })
                    .replace(/\n\s*in /g, ' in ')
                    .replace(/\n{2,}/g, '\n')
                    .replace(/\nStack Trace\n[\s\S]*/i, '')
                    .replace(/\n$/, '')
                    .trim();
            errorFile
                    .then(function (errorTxt) {
                        errorTxt = errorTxt
                            .replace(/\{path\}/g, '')
                            .replace(/\{pathrel\}/g, '')
                            .replace(/\{pathhref\}/g, 'http://localhost:8081/test/less/errors/')
                            .replace(/\{404status\}/g, ' (404)')
                            .replace(/\{node\}[\s\S]*\{\/node\}/g, '')
                            .replace(/\n$/, '')
                            .trim();
                        expect(actualErrorMsg).toEqual(errorTxt);
                        if (errorTxt == actualErrorMsg) {
                            actualErrorElement.style.display = 'none';
                        }
                        done();
                    });
        });
    });
};

testErrorSheetConsole = function (sheet) {
    it(sheet.id + ' should match an error', function (done) {
        var lessHref = sheet.href,
            id = sheet.id.replace(/^original-less:/, 'less-error-message:'),
            errorHref = lessHref.replace(/.less$/, '.txt'),
            errorFile = loadFile(errorHref),
            actualErrorElement = document.getElementById(id),
            actualErrorMsg = logMessages[logMessages.length - 1]
                .replace(/\nStack Trace\n[\s\S]*/, '');

        describe('the error', function () {
            expect(actualErrorElement).toBe(null);
        });

        errorFile
            .then(function (errorTxt) {
                errorTxt
                    .replace(/\{path\}/g, '')
                    .replace(/\{pathrel\}/g, '')
                    .replace(/\{pathhref\}/g, 'http://localhost:8081/browser/less/')
                    .replace(/\{404status\}/g, ' (404)')
                    .replace(/\{node\}.*\{\/node\}/g, '')
                    .trim();
                expect(actualErrorMsg).toEqual(errorTxt);
                done();
            });
    });
};

loadFile = function (href) {
    return new Promise(function (resolve, reject) {
        var request = new XMLHttpRequest();
        request.open('GET', href, true);
        request.onreadystatechange = function () {
            if (request.readyState == 4) {
                resolve(request.responseText.replace(/\r/g, ''));
            }
        };
        request.send(null);
    });
};

jasmine.DEFAULT_TIMEOUT_INTERVAL = 90000;
