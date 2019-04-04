var alreadyRun = false;

describe('less.js modify vars', function () {
    beforeEach(function (done) {
        // simulating "setUp" or "beforeAll" method
        if (alreadyRun) {
            done();
            return;
        }

        alreadyRun = true;

        less.pageLoadFinished
            .then(function () {
                less.modifyVars({
                    var1: 'green',
                    var2: 'purple',
                    scale: 20
                }).then(function () {
                    done();
                });
            });
    });

    testLessEqualsInDocument();
    it('Should log only 2 XHR requests', function (done) {
        var xhrLogMessages = logMessages.filter(function (item) {
            return (/XHR: Getting '/).test(item);
        });
        expect(xhrLogMessages.length).toEqual(2);
        done();
    });
});
