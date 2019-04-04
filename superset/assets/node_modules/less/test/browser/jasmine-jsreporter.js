/*
 This file is part of the Jasmine JSReporter project from Ivan De Marino.

 Copyright (C) 2011-2014 Ivan De Marino <http://ivandemarino.me>
 Copyright (C) 2014 Alex Treppass <http://alextreppass.co.uk>

 Redistribution and use in source and binary forms, with or without
 modification, are permitted provided that the following conditions are met:

 * Redistributions of source code must retain the above copyright
 notice, this list of conditions and the following disclaimer.
 * Redistributions in binary form must reproduce the above copyright
 notice, this list of conditions and the following disclaimer in the
 documentation and/or other materials provided with the distribution.
 * Neither the name of the <organization> nor the
 names of its contributors may be used to endorse or promote products
 derived from this software without specific prior written permission.

 THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 ARE DISCLAIMED. IN NO EVENT SHALL IVAN DE MARINO BE LIABLE FOR ANY
 DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
 THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
(function (jasmine) {

    if (!jasmine) {
        throw new Error("[Jasmine JSReporter] 'Jasmine' library not found");
    }

    // ------------------------------------------------------------------------
    // Jasmine JSReporter for Jasmine 1.x
    // ------------------------------------------------------------------------

    /**
     * Calculate elapsed time, in Seconds.
     * @param startMs Start time in Milliseconds
     * @param finishMs Finish time in Milliseconds
     * @return Elapsed time in Seconds */
    function elapsedSec(startMs, finishMs) {
        return (finishMs - startMs) / 1000;
    }

    /**
     * Round an amount to the given number of Digits.
     * If no number of digits is given, than '2' is assumed.
     * @param amount Amount to round
     * @param numOfDecDigits Number of Digits to round to. Default value is '2'.
     * @return Rounded amount */
    function round(amount, numOfDecDigits) {
        numOfDecDigits = numOfDecDigits || 2;
        return Math.round(amount * Math.pow(10, numOfDecDigits)) / Math.pow(10, numOfDecDigits);
    }

    /**
     * Create a new array which contains only the failed items.
     * @param items Items which will be filtered
     * @returns {Array} of failed items */
    function failures(items) {
        var fs = [], i, v;
        for (i = 0; i < items.length; i += 1) {
            v = items[i];
            if (!v.passed_) {
                fs.push(v);
            }
        }
        return fs;
    }

    /**
     * Collect information about a Suite, recursively, and return a JSON result.
     * @param suite The Jasmine Suite to get data from
     */
    function getSuiteData(suite) {
        var suiteData = {
                description : suite.description,
                durationSec : 0,
                specs: [],
                suites: [],
                passed: true
            },
            specs = suite.specs(),
            suites = suite.suites(),
            i, ilen;

        // Loop over all the Suite's Specs
        for (i = 0, ilen = specs.length; i < ilen; ++i) {
            suiteData.specs[i] = {
                description : specs[i].description,
                durationSec : specs[i].durationSec,
                passed : specs[i].results().passedCount === specs[i].results().totalCount,
                skipped : specs[i].results().skipped,
                passedCount : specs[i].results().passedCount,
                failedCount : specs[i].results().failedCount,
                totalCount : specs[i].results().totalCount,
                failures: failures(specs[i].results().getItems())
            };
            suiteData.passed = !suiteData.specs[i].passed ? false : suiteData.passed;
            suiteData.durationSec += suiteData.specs[i].durationSec;
        }

        // Loop over all the Suite's sub-Suites
        for (i = 0, ilen = suites.length; i < ilen; ++i) {
            suiteData.suites[i] = getSuiteData(suites[i]); //< recursive population
            suiteData.passed = !suiteData.suites[i].passed ? false : suiteData.passed;
            suiteData.durationSec += suiteData.suites[i].durationSec;
        }

        // Rounding duration numbers to 3 decimal digits
        suiteData.durationSec = round(suiteData.durationSec, 4);

        return suiteData;
    }

    var JSReporter =  function () {
    };

    JSReporter.prototype = {
        reportRunnerStarting: function (runner) {
            // Nothing to do
        },

        reportSpecStarting: function (spec) {
            // Start timing this spec
            spec.startedAt = new Date();
        },

        reportSpecResults: function (spec) {
            // Finish timing this spec and calculate duration/delta (in sec)
            spec.finishedAt = new Date();
            // If the spec was skipped, reportSpecStarting is never called and spec.startedAt is undefined
            spec.durationSec = spec.startedAt ? elapsedSec(spec.startedAt.getTime(), spec.finishedAt.getTime()) : 0;
        },

        reportSuiteResults: function (suite) {
            // Nothing to do
        },

        reportRunnerResults: function (runner) {
            var suites = runner.suites(),
                i, j, ilen;

            // Attach results to the "jasmine" object to make those results easy to scrap/find
            jasmine.runnerResults = {
                suites: [],
                durationSec : 0,
                passed : true
            };

            // Loop over all the Suites
            for (i = 0, ilen = suites.length, j = 0; i < ilen; ++i) {
                if (suites[i].parentSuite === null) {
                    jasmine.runnerResults.suites[j] = getSuiteData(suites[i]);
                    // If 1 suite fails, the whole runner fails
                    jasmine.runnerResults.passed = !jasmine.runnerResults.suites[j].passed ? false : jasmine.runnerResults.passed;
                    // Add up all the durations
                    jasmine.runnerResults.durationSec += jasmine.runnerResults.suites[j].durationSec;
                    j++;
                }
            }

            // Decorate the 'jasmine' object with getters
            jasmine.getJSReport = function () {
                if (jasmine.runnerResults) {
                    return jasmine.runnerResults;
                }
                return null;
            };
            jasmine.getJSReportAsString = function () {
                return JSON.stringify(jasmine.getJSReport());
            };
        }
    };

    // export public
    jasmine.JSReporter = JSReporter;

    // ------------------------------------------------------------------------
    // Jasmine JSReporter for Jasmine 2.0
    // ------------------------------------------------------------------------

    /*
     Simple timer implementation
     */
    var Timer = function () {};

    Timer.prototype.start = function () {
        this.startTime = new Date().getTime();
        return this;
    };

    Timer.prototype.elapsed = function () {
        if (this.startTime == null) {
            return -1;
        }
        return new Date().getTime() - this.startTime;
    };

    /*
     Utility methods
     */
    var _extend = function (obj1, obj2) {
        for (var prop in obj2) {
            obj1[prop] = obj2[prop];
        }
        return obj1;
    };
    var _clone = function (obj) {
        if (obj !== Object(obj)) {
            return obj;
        }
        return _extend({}, obj);
    };

    jasmine.JSReporter2 = function () {
        this.specs  = {};
        this.suites = {};
        this.rootSuites = [];
        this.suiteStack = [];

        // export methods under jasmine namespace
        jasmine.getJSReport = this.getJSReport;
        jasmine.getJSReportAsString = this.getJSReportAsString;
    };

    var JSR = jasmine.JSReporter2.prototype;

    // Reporter API methods
    // --------------------

    JSR.suiteStarted = function (suite) {
        suite = this._cacheSuite(suite);
        // build up suite tree as we go
        suite.specs = [];
        suite.suites = [];
        suite.passed = true;
        suite.parentId = this.suiteStack.slice(this.suiteStack.length - 1)[0];
        if (suite.parentId) {
            this.suites[suite.parentId].suites.push(suite);
        } else {
            this.rootSuites.push(suite.id);
        }
        this.suiteStack.push(suite.id);
        suite.timer = new Timer().start();
    };

    JSR.suiteDone = function (suite) {
        suite = this._cacheSuite(suite);
        suite.duration = suite.timer.elapsed();
        suite.durationSec = suite.duration / 1000;
        this.suiteStack.pop();

        // maintain parent suite state
        var parent = this.suites[suite.parentId];
        if (parent) {
            parent.passed = parent.passed && suite.passed;
        }

        // keep report representation clean
        delete suite.timer;
        delete suite.id;
        delete suite.parentId;
        delete suite.fullName;
    };

    JSR.specStarted = function (spec) {
        spec = this._cacheSpec(spec);
        spec.timer = new Timer().start();
        // build up suites->spec tree as we go
        spec.suiteId = this.suiteStack.slice(this.suiteStack.length - 1)[0];
        this.suites[spec.suiteId].specs.push(spec);
    };

    JSR.specDone = function (spec) {
        spec = this._cacheSpec(spec);

        spec.duration = spec.timer.elapsed();
        spec.durationSec = spec.duration / 1000;

        spec.skipped = spec.status === 'pending';
        spec.passed = spec.skipped || spec.status === 'passed';

        spec.totalCount = spec.passedExpectations.length + spec.failedExpectations.length;
        spec.passedCount = spec.passedExpectations.length;
        spec.failedCount = spec.failedExpectations.length;
        spec.failures = [];

        for (var i = 0, j = spec.failedExpectations.length; i < j; i++) {
            var fail = spec.failedExpectations[i];
            spec.failures.push({
                type: 'expect',
                expected: fail.expected,
                passed: false,
                message: fail.message,
                matcherName: fail.matcherName,
                trace: {
                    stack: fail.stack
                }
            });
        }

        // maintain parent suite state
        var parent = this.suites[spec.suiteId];
        if (spec.failed) {
            parent.failingSpecs.push(spec);
        }
        parent.passed = parent.passed && spec.passed;

        // keep report representation clean
        delete spec.timer;
        delete spec.totalExpectations;
        delete spec.passedExpectations;
        delete spec.suiteId;
        delete spec.fullName;
        delete spec.id;
        delete spec.status;
        delete spec.failedExpectations;
    };

    JSR.jasmineDone = function () {
        this._buildReport();
    };

    JSR.getJSReport = function () {
        if (jasmine.jsReport) {
            return jasmine.jsReport;
        }
    };

    JSR.getJSReportAsString = function () {
        if (jasmine.jsReport) {
            return JSON.stringify(jasmine.jsReport);
        }
    };

    // Private methods
    // ---------------

    JSR._haveSpec = function (spec) {
        return this.specs[spec.id] != null;
    };

    JSR._cacheSpec = function (spec) {
        var existing = this.specs[spec.id];
        if (existing == null) {
            existing = this.specs[spec.id] = _clone(spec);
        } else {
            _extend(existing, spec);
        }
        return existing;
    };

    JSR._haveSuite = function (suite) {
        return this.suites[suite.id] != null;
    };

    JSR._cacheSuite = function (suite) {
        var existing = this.suites[suite.id];
        if (existing == null) {
            existing = this.suites[suite.id] = _clone(suite);
        } else {
            _extend(existing, suite);
        }
        return existing;
    };

    JSR._buildReport = function () {
        var overallDuration = 0;
        var overallPassed = true;
        var overallSuites = [];

        for (var i = 0, j = this.rootSuites.length; i < j; i++) {
            var suite = this.suites[this.rootSuites[i]];
            overallDuration += suite.duration;
            overallPassed = overallPassed && suite.passed;
            overallSuites.push(suite);
        }

        jasmine.jsReport = {
            passed: overallPassed,
            durationSec: overallDuration / 1000,
            suites: overallSuites
        };
    };

})(jasmine);
