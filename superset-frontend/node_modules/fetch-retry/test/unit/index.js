'use strict';
var fetchBuilder = require('../../');
var sinon = require('sinon');
var expect = require('expectations');
var Promise = require('es6-promise');

describe('fetchBuilder', function () {

  it('should accept fetch function as argument', function () {
    expect(function () {
      fetchBuilder();
    }).toThrow({
      name: 'ArgumentError',
      message: 'fetch must be a function'
    });
  });

  it('should accept defaults object as argument', function () {
    expect(function () {
      fetchBuilder(function () { }, "");
    }).toThrow({
      name: 'ArgumentError',
      message: 'defaults must be an object'
    });
  });

  it('should return fetchRetry function', function () {
    expect(typeof fetchBuilder(function () { }, {retries: 1})).toBe('function');
  });
});

describe('fetch-retry', function () {

  var fetch;
  var fetchRetry;

  var deferred1;
  var deferred2;
  var deferred3;
  var deferred4;

  var thenCallback;
  var catchCallback;

  var clock;
  var delay;

  beforeEach(function () {
    delay = 1000;
    clock = sinon.useFakeTimers();
  });

  afterEach(function () {
    clock.restore();
  });

  beforeEach(function () {
    deferred1 = defer();
    deferred2 = defer();
    deferred3 = defer();
    deferred4 = defer();

    fetch = sinon.stub();
    fetch.onCall(0).returns(deferred1.promise);
    fetch.onCall(1).returns(deferred2.promise);
    fetch.onCall(2).returns(deferred3.promise);
    fetch.onCall(3).returns(deferred4.promise);

    fetchRetry = fetchBuilder(fetch);
  });

  describe('#input', function () {

    var expectedUrl = 'http://some-url.com';

    beforeEach(function () {
      fetchRetry(expectedUrl);
    });

    it('passes #input to fetch', function () {
      expect(fetch.getCall(0).args[0]).toBe(expectedUrl);
    });

  });

  describe('#init', function () {

    describe('when #init is provided', function () {

      var init;

      beforeEach(function () {
        init = {
          retries: 3,
          whatever: 'something'
        };

        fetchRetry('http://someUrl', init);
      });

      it('passes init to fetch', function () {
        expect(fetch.getCall(0).args[1]).toEqual(init);
      });

      describe('when #init.retryOn is not an array or function', () => {

        it('throws exception', () => {
          expect(function () {
            init.retryOn = 503;
            fetchRetry('http://someUrl', init);
          }).toThrow({
            name: 'ArgumentError',
            message: 'retryOn property expects an array or function'
          });
        });

      });

    });

    describe('when #init is undefined or null', function () {

      [undefined, null].forEach(function (testCase) {

        beforeEach(function () {
          fetchRetry('http://someUrl', testCase);
        });

        it('does not pass through init to fetch', function () {
          expect(fetch.getCall(0).args[1]).toEqual(undefined);
        });

      });

    });

  });

  describe('#init.retries', function () {

    describe('when #init.retries=3 (default)', function () {

      beforeEach(function () {
        thenCallback = sinon.spy();
        catchCallback = sinon.spy();

        fetchRetry('http://someurl')
          .then(thenCallback)
          .catch(catchCallback);
      });

      describe('when first call is a success', function () {

        beforeEach(function () {
          deferred1.resolve({ status: 200 });
        });

        describe('when resolved', function () {

          it('invokes the then callback', function () {
            expect(thenCallback.called).toBe(true);
          });

          it('calls fetch once', function () {
            expect(fetch.callCount).toBe(1);
          });

        });

      });

      describe('when first call is a failure', function () {

        beforeEach(function () {
          deferred1.reject();
        });

        describe('when second call is a success', function () {

          beforeEach(function () {
            clock.tick(delay);
            deferred2.resolve({ status: 200 });
          });

          describe('when resolved', function () {

            it('invokes the then callback', function () {
              expect(thenCallback.called).toBe(true);
            });

            it('calls fetch twice', function () {
              expect(fetch.callCount).toBe(2);
            });

          });

        });

        describe('when second call is a failure', function () {

          beforeEach(function () {
            deferred2.reject();
            clock.tick(delay);
          });

          describe('when third call is a success', function () {

            beforeEach(function () {
              deferred3.resolve({ status: 200 });
              clock.tick(delay);
            });

            describe('when resolved', function () {

              it('invokes the then callback', function () {
                expect(thenCallback.called).toBe(true);
              });

              it('calls fetch three times', function () {
                expect(fetch.callCount).toBe(3);
              });

            });

          });

          describe('when third call is a failure', function () {

            beforeEach(function () {
              deferred3.reject();
              clock.tick(delay);
            });

            describe('when fourth call is a success', function () {

              beforeEach(function () {
                deferred4.resolve({ status: 200 });
                clock.tick(delay);
              });

              describe('when resolved', function () {

                it('invokes the then callback', function () {
                  expect(thenCallback.called).toBe(true);
                });

                it('calls fetch four times', function () {
                  expect(fetch.callCount).toBe(4);
                });

              });

            });

            describe('when fourth call is a failure', function () {

              beforeEach(function () {
                deferred4.reject();
                clock.tick(delay);
              });

              describe('when rejected', function () {

                it('invokes the catch callback', function () {
                  expect(catchCallback.called).toBe(true);
                });

                it('does not call fetch again', function () {
                  expect(fetch.callCount).toBe(4);
                });

              });

            });

          });

        });

      });

    });

    describe('when #defaults.retries is not a a positive integer', () => {
      ['1', -1, 'not a number', null].forEach(invalidRetries => {
        it('throws error', () => {
          const expectedError = {
            name: 'ArgumentError',
            message: 'retries must be a positive integer'
          };
          expect(() => {
            var fetchRetryWithDefaults = fetchBuilder(fetch, {retries: invalidRetries});
            fetchRetryWithDefaults('http://someurl');
          }).toThrow(expectedError);
        });
      });
    });

    describe('when #defaults.retryDelay is not a a positive integer', () => {

      ['1', -1, 'not a number', null].forEach(invalidDelay => {

        it('throws error', () => {
          const expectedError = {
            name: 'ArgumentError',
            message: 'retryDelay must be a positive integer or a function returning a positive integer'
          };
          expect(() => {
            var fetchRetryWithDefaults = fetchBuilder(fetch, { retryDelay: invalidDelay });
            fetchRetryWithDefaults('http://someurl');
          }).toThrow(expectedError);
        });

      });

    });

    describe('when #defaults.retryDelay is a function', function () {

      var defaults;
      var retryDelay;

      beforeEach(function () {
        retryDelay = sinon.stub().returns(5000);
        defaults = {
          retryDelay: retryDelay
        };

        thenCallback = sinon.spy();

        var fetchRetryWithDefaults = fetchBuilder(fetch, defaults);
        fetchRetryWithDefaults('http://someUrl')
          .then(thenCallback);
      });
    });

    describe('when #defaults.retryOn is not an array or function', function () {

      var defaults = {};

      describe('when #defaults.retryOn is not an array or function', () => {

        it('throws exception', () => {
          expect(function () {
            defaults.retryOn = 503;
            var fetchRetryWithDefaults = fetchBuilder(fetch, defaults);
            fetchRetryWithDefaults('http://someUrl');
          }).toThrow({
            name: 'ArgumentError',
            message: 'retryOn property expects an array or function'
          });
        });

      });

    });

    describe('when #defaults.retries=0', function () {
      beforeEach(function () {
        thenCallback = sinon.spy();
        catchCallback = sinon.spy();

        var fetchRetryWithDefaults = fetchBuilder(fetch, {retries: 0});

        fetchRetryWithDefaults('http://someurl')
          .then(thenCallback)
          .catch(catchCallback);
      });

      describe('when first call is a failure', function () {
        beforeEach(function () {
          deferred1.reject();
        });

        describe('when rejected', function () {

          it('invokes the catch callback', function () {
            expect(catchCallback.called).toBe(true);
          });

          it('does not call fetch again', function () {
            expect(fetch.callCount).toBe(1);
          });
        });
      })
    })
    
    describe('when #init.retries=1', function () {

      beforeEach(function () {
        thenCallback = sinon.spy();
        catchCallback = sinon.spy();

        fetchRetry('http://someurl', { retries: 1 })
          .then(thenCallback)
          .catch(catchCallback);
      });

      describe('when first call is a success', function () {

        beforeEach(function () {
          deferred1.resolve({ status: 200 });
        });

        describe('when resolved', function () {

          it('invokes the then callback', function () {
            expect(thenCallback.called).toBe(true);
          });

          it('calls fetch once', function () {
            expect(fetch.callCount).toBe(1);
          });

        });

      });

      describe('when first call is a failure', function () {

        beforeEach(function () {
          deferred1.reject();
          clock.tick(delay);
        });

        describe('when second call is a success', function () {

          beforeEach(function () {
            deferred2.resolve({ status: 200 });
            clock.tick(delay);
          });

          describe('when resolved', function () {

            it('invokes the then callback', function () {
              expect(thenCallback.called).toBe(true);
            });

            it('calls fetch twice', function () {
              expect(fetch.callCount).toBe(2);
            });

          });

        });

        describe('when second call is a failure', function () {

          beforeEach(function () {
            deferred2.reject();
            clock.tick(delay);
          });

          describe('when rejected', function () {

            it('invokes the catch callback', function () {
              expect(catchCallback.called).toBe(true);
            });

            it('does not call fetch again', function () {
              expect(fetch.callCount).toBe(2);
            });

          });

        });

      });

    });

    describe('when #init.retries=0', function () {

      beforeEach(function () {
        thenCallback = sinon.spy();
        catchCallback = sinon.spy();

        fetchRetry('http://someurl', { retries: 0 })
          .then(thenCallback)
          .catch(catchCallback);
      });

      describe('when first call is a success', function () {

        beforeEach(function () {
          deferred1.resolve({ status: 200 });
        });

        describe('when resolved', function () {

          it('invokes the then callback', function () {
            expect(thenCallback.called).toBe(true);
          });

          it('calls fetch once', function () {
            expect(fetch.callCount).toBe(1);
          });

        });

      });

      describe('when first call is a failure', function () {

        beforeEach(function () {
          deferred1.reject();
        });

        describe('when rejected', () => {

          it('invokes the catch callback', function () {
            expect(catchCallback.called).toBe(true);
          });

        });

      });

    });

    describe('when #init.retries is not a a positive integer', () => {

      ['1', -1, 'not a number', null].forEach(invalidRetries => {

        it('throws error', () => {
          const expectedError = {
            name: 'ArgumentError',
            message: 'retries must be a positive integer'
          };
          expect(() => {
            fetchRetry('http://someurl', { retries: invalidRetries });
          }).toThrow(expectedError);
        });

      });

    });

  });

  describe('#init.retryDelay', function () {

    describe('when #init.retryDelay is a number', function () {

      var init;
      var retryDelay;

      beforeEach(function () {
        retryDelay = 5000;
        init = {
          retryDelay: retryDelay
        };

        thenCallback = sinon.spy();

        fetchRetry('http://someUrl', init)
          .then(thenCallback);
      });

      describe('when first call is unsuccessful', function () {

        beforeEach(function () {
          deferred1.reject();
        });

        describe('after specified time', function () {

          beforeEach(function () {
            clock.tick(retryDelay);
          });

          it('invokes fetch again', function () {
            expect(fetch.callCount).toBe(2);
          });

        });

        describe('after less than specified time', function () {

          beforeEach(function () {
            clock.tick(1000);
          });

          it('does not invoke fetch again', function () {
            expect(fetch.callCount).toBe(1);
          });

        });

      });

    });

    describe('when #init.retryDelay is 0', function () {

      var init;
      var retryDelay;

      beforeEach(function () {
        retryDelay = 0;
        init = {
          retryDelay: retryDelay
        };

        thenCallback = sinon.spy();

        fetchRetry('http://someUrl', init)
          .then(thenCallback);
      });

      describe('when first call is unsuccessful', function () {

        beforeEach(function () {
          deferred1.reject();
        });

        describe('after one event loop tick', function () {

          beforeEach(function () {
            clock.tick(0);
          });

          it('invokes fetch again', function () {
            expect(fetch.callCount).toBe(2);
          });

        });

      });

    });

    describe('when #init.retryDelay is not a a positive integer', () => {

      ['1', -1, 'not a number', null].forEach(invalidDelay => {

        it('throws error', () => {
          const expectedError = {
            name: 'ArgumentError',
            message: 'retryDelay must be a positive integer or a function returning a positive integer'
          };
          expect(() => {
            fetchRetry('http://someurl', { retryDelay: invalidDelay });
          }).toThrow(expectedError);
        });

      });

    });

    describe('when #init.retryDelay is a function', function () {

      var init;
      var retryDelay;

      beforeEach(function () {
        retryDelay = sinon.stub().returns(5000);
        init = {
          retryDelay: retryDelay
        };

        thenCallback = sinon.spy();

        fetchRetry('http://someUrl', init)
          .then(thenCallback);
      });

      describe('when first call is unsuccessful', function () {

        beforeEach(function () {
          deferred1.reject(new Error('first error'));
        });

        describe('when the second call is a success', function () {

          beforeEach(function () {
            deferred2.resolve({ status: 200 });
            clock.tick(5000);
          });

          it('invokes the retryDelay function', function () {
            expect(retryDelay.called).toBe(true);
            expect(retryDelay.lastCall.args[0]).toEqual(0);
            expect(retryDelay.lastCall.args[1].message).toEqual('first error');
          });


        });

        describe('when second call is a failure', function () {

          beforeEach(function () {
            deferred2.reject(new Error('second error'));
            clock.tick(5000);
          });

          describe('when the third call is a success', function () {

            beforeEach(function () {
              deferred3.resolve({ status: 200 });
              clock.tick(5000);
            });

            it('invokes the retryDelay function again', function () {
              expect(retryDelay.callCount).toBe(2);
              expect(retryDelay.lastCall.args[0]).toEqual(1);
              expect(retryDelay.lastCall.args[1].message).toEqual('second error');
            });

          });

        });

      });

    });

  });

  describe('#init.retryOn', () => {

    describe('when #init.retryOn is an array', () => {

      var init;
      var retryOn;

      beforeEach(function () {
        retryOn = [503, 404];
        init = {
          retryOn: retryOn
        };

        thenCallback = sinon.spy();
        catchCallback = sinon.spy();

        fetchRetry('http://someUrl', init)
          .then(thenCallback)
          .catch((catchCallback));
      });

      describe('when first fetch is resolved with status code specified in retryOn array', () => {

        beforeEach(() => {
          deferred1.resolve({ status: 503 });
        });

        describe('after specified delay', () => {

          beforeEach(() => {
            clock.tick(delay);
          });

          it('retries fetch', () => {
            expect(fetch.callCount).toBe(2);
          });

          describe('when second fetch resolves with a different status code', () => {

            beforeEach(() => {
              deferred2.resolve({ status: 200 });
            });

            describe('when resolved', () => {

              it('invokes the then callback', function () {
                expect(thenCallback.called).toBe(true);
              });

              it('has called fetch twice', function () {
                expect(fetch.callCount).toBe(2);
              });

            });

          });

        });

      });

    });

    describe('when #init.retryOn is a function', function () {

      var init;
      var retryOn;

      beforeEach(function () {
        retryOn = sinon.stub();
        init = {
          retryOn: retryOn
        };

        thenCallback = sinon.spy();
        catchCallback = sinon.spy();

        fetchRetry('http://someUrl', init)
          .then(thenCallback)
          .catch((catchCallback));
      });

      describe('when first attempt is rejected due to network error', function () {

        describe('when #retryOn() returns true', () => {

          beforeEach(function () {
            retryOn.returns(true);
            deferred1.reject(new Error('first error'));
          });

          describe('when rejected', function () {

            it('invokes #retryOn function with an error', function () {
              expect(retryOn.called).toBe(true);
              expect(retryOn.lastCall.args.length).toBe(3);
              expect(retryOn.lastCall.args[0]).toBe(0);
              expect(retryOn.lastCall.args[1] instanceof Error).toBe(true);
              expect(retryOn.lastCall.args[2]).toBe(null);
            });

            describe('after specified time', function () {

              beforeEach(function () {
                clock.tick(delay);
              });

              it('invokes fetch again', function () {
                expect(fetch.callCount).toBe(2);
              });

              describe('when the second call is unsuccessful', function () {

                beforeEach(function () {
                  deferred2.reject(new Error('second error'));
                  clock.tick(delay);
                });

                describe('when rejected', function () {

                  it('invokes the #retryOn function twice', function () {
                    expect(retryOn.callCount).toBe(2);
                    expect(retryOn.lastCall.args[0]).toBe(1);
                  });

                });

              });

            });

          });

        });

        describe('when #retryOn() returns false', () => {

          beforeEach(function () {
            retryOn.returns(false);
            deferred1.reject(new Error('first error'));
          });

          describe('when rejected', function () {

            it('invokes #retryOn function with an error', function () {
              expect(retryOn.called).toBe(true);
              expect(retryOn.lastCall.args.length).toBe(3);
              expect(retryOn.lastCall.args[0]).toBe(0);
              expect(retryOn.lastCall.args[1] instanceof Error).toBe(true);
              expect(retryOn.lastCall.args[2]).toBe(null);
            });

            describe('after specified time', function () {

              beforeEach(function () {
                clock.tick(delay);
              });

              it('invokes the catch callback', function () {
                expect(catchCallback.called).toBe(true);
              });

              it('does not call fetch again', function () {
                expect(fetch.callCount).toBe(1);
              });

            });

          });

        });

      });

      describe('when first attempt is resolved', function () {

        describe('when #retryOn() returns true', () => {

          beforeEach(function () {
            retryOn.returns(true);
            deferred1.resolve({ status: 200 });
          });

          describe('after specified delay', () => {

            beforeEach(function () {
              clock.tick(delay);
            });

            it('calls fetch again', function () {
              expect(fetch.callCount).toBe(2);
            });

            describe('when second call is resolved', () => {

              beforeEach(function () {
                deferred2.resolve({ status: 200 });
                clock.tick(delay);
              });

              it('invokes the #retryOn function with the response', function () {
                expect(retryOn.called).toBe(true);
                expect(retryOn.lastCall.args.length).toBe(3);
                expect(retryOn.lastCall.args[0]).toBe(0);
                expect(retryOn.lastCall.args[1]).toBe(null);
                expect(retryOn.lastCall.args[2]).toEqual({ status: 200 });
              });

            });

          });

        });

        describe('when #retryOn() returns false', () => {

          beforeEach(function () {
            retryOn.returns(false);
            deferred1.resolve({ status: 502 });
          });

          describe('when resolved', () => {

            it('invokes the then callback', function () {
              expect(thenCallback.called).toBe(true);
            });

            it('calls fetch 1 time only', function () {
              expect(fetch.callCount).toBe(1);
            });

          });

        });

      });

    });

    describe('when #init.retryOn is not an array or function', function () {

      var init;

      describe('when #init.retryOn is not an array or function', () => {

        it('throws exception', () => {
          expect(function () {
            init.retryOn = 503;
            fetchRetry('http://someUrl', init);
          }).toThrow({
            name: 'ArgumentError',
            message: 'retryOn property expects an array or function'
          });
        });

      });

    });

  });

});

function defer() {
  var resolve, reject;
  var promise = new Promise(function () {
    resolve = arguments[0];
    reject = arguments[1];
  });
  return {
    resolve: resolve,
    reject: reject,
    promise: promise
  };
}
