'use strict'

const assert = require('chai').assert
const proxyquire = require('proxyquire')
const spooks = require('spooks')
const Promise = require('bluebird')

const modulePath = '../../src/parse'

suite('parse:', () => {
  test('require does not throw', () => {
    assert.doesNotThrow(() => {
      require(modulePath)
    })
  })

  test('require returns function', () => {
    assert.isFunction(require(modulePath))
  })

  suite('require:', () => {
    let log, results, parse

    setup(() => {
      log = {}
      results = {
        walk: [
          {
            on: spooks.fn({ name: 'on', log: log }),
            pause: spooks.fn({ name: 'pause', log: log, results: [ () => {} ] }),
            removeAllListeners: spooks.fn({ name: 'removeAllListeners', log: log })
          }
        ]
      }
      parse = proxyquire(modulePath, {
        './walk': spooks.fn({
          name: 'walk',
          log: log,
          results: results.walk
        })
      })
    })

    test('parse expects one argument', () => {
      assert.lengthOf(parse, 1)
    })

    test('parse does not throw', () => {
      assert.doesNotThrow(() => {
        parse()
      })
    })

    test('parse does not throw if reviver is an object', () => {
      assert.doesNotThrow(() => {
        parse({}, { reviver: {} }).catch(() => {})
      })
    })

    test('parse does not throw if revive is a function', () => {
      assert.doesNotThrow(() => {
        parse({}, { reviver: () => {} })
      })
    })

    test('parse returns a promise', () => {
      assert.instanceOf(parse(), Promise)
    })

    test('parse returns a different type of promise if the option is set', () => {
      assert.isFunction(global.Promise)
      assert.notStrictEqual(Promise, global.Promise)
      assert.instanceOf(parse('', { Promise: global.Promise }), global.Promise)
    })

    test('parse rejects immediately if reviver is an object', () => {
      return parse({}, { reviver: {} })
        .then(() => assert(false))
        .catch(error => assert.instanceOf(error, Error))
    })

    test('parse does not reject immediately if reviver is a function', () => {
      parse({}, { reviver: () => {} })
        .catch(error => assert(false))
    })

    test('walk was not called', () => {
      assert.strictEqual(log.counts.walk, 0)
    })

    test('EventEmitter.on was not called', () => {
      assert.strictEqual(log.counts.on, 0)
    })

    suite('parse:', () => {
      let stream, options

      setup(() => {
        stream = {}
        options = {}
        parse(stream, options)
          .then(spooks.fn({ name: 'resolve', log: log }))
          .catch(spooks.fn({ name: 'reject', log: log }))
      })

      test('walk was called once', () => {
        assert.strictEqual(log.counts.walk, 1)
        assert.isUndefined(log.these.walk[0])
      })

      test('walk was called correctly', () => {
        assert.lengthOf(log.args.walk[0], 2)
        assert.strictEqual(log.args.walk[0][0], stream)
        assert.lengthOf(Object.keys(log.args.walk[0][0]), 0)
        assert.strictEqual(log.args.walk[0][1], options)
        assert.lengthOf(Object.keys(log.args.walk[0][1]), 0)
      })

      test('EventEmitter.on was called eleven times', () => {
        assert.strictEqual(log.counts.on, 11)
        assert.strictEqual(log.these.on[0], results.walk[0])
        assert.strictEqual(log.these.on[1], results.walk[0])
        assert.strictEqual(log.these.on[2], results.walk[0])
        assert.strictEqual(log.these.on[3], results.walk[0])
        assert.strictEqual(log.these.on[4], results.walk[0])
        assert.strictEqual(log.these.on[5], results.walk[0])
        assert.strictEqual(log.these.on[6], results.walk[0])
        assert.strictEqual(log.these.on[7], results.walk[0])
        assert.strictEqual(log.these.on[8], results.walk[0])
        assert.strictEqual(log.these.on[9], results.walk[0])
        assert.strictEqual(log.these.on[10], results.walk[0])
      })

      test('EventEmitter.on was called correctly first time', () => {
        assert.lengthOf(log.args.on[0], 2)
        assert.strictEqual(log.args.on[0][0], 'arr')
        assert.isFunction(log.args.on[0][1])
      })

      test('EventEmitter.on was called correctly second time', () => {
        assert.lengthOf(log.args.on[1], 2)
        assert.strictEqual(log.args.on[1][0], 'obj')
        assert.isFunction(log.args.on[1][1])
        assert.notStrictEqual(log.args.on[1][1], log.args.on[0][1])
      })

      test('EventEmitter.on was called correctly third time', () => {
        assert.lengthOf(log.args.on[2], 2)
        assert.strictEqual(log.args.on[2][0], 'pro')
        assert.isFunction(log.args.on[2][1])
        assert.notStrictEqual(log.args.on[2][1], log.args.on[0][1])
        assert.notStrictEqual(log.args.on[2][1], log.args.on[1][1])
      })

      test('EventEmitter.on was called correctly fourth time', () => {
        assert.lengthOf(log.args.on[3], 2)
        assert.strictEqual(log.args.on[3][0], 'str')
        assert.isFunction(log.args.on[3][1])
        assert.notStrictEqual(log.args.on[3][1], log.args.on[0][1])
        assert.notStrictEqual(log.args.on[3][1], log.args.on[1][1])
        assert.notStrictEqual(log.args.on[3][1], log.args.on[2][1])
      })

      test('EventEmitter.on was called correctly fifth time', () => {
        assert.lengthOf(log.args.on[4], 2)
        assert.strictEqual(log.args.on[4][0], 'num')
        assert.isFunction(log.args.on[4][1])
        assert.strictEqual(log.args.on[4][1], log.args.on[3][1])
      })

      test('EventEmitter.on was called correctly sixth time', () => {
        assert.lengthOf(log.args.on[5], 2)
        assert.strictEqual(log.args.on[5][0], 'lit')
        assert.isFunction(log.args.on[5][1])
        assert.strictEqual(log.args.on[5][1], log.args.on[3][1])
      })

      test('EventEmitter.on was called correctly seventh time', () => {
        assert.lengthOf(log.args.on[6], 2)
        assert.strictEqual(log.args.on[6][0], 'end-arr')
        assert.isFunction(log.args.on[6][1])
        assert.notStrictEqual(log.args.on[6][1], log.args.on[0][1])
        assert.notStrictEqual(log.args.on[6][1], log.args.on[1][1])
        assert.notStrictEqual(log.args.on[6][1], log.args.on[2][1])
        assert.notStrictEqual(log.args.on[6][1], log.args.on[3][1])
      })

      test('EventEmitter.on was called correctly eighth time', () => {
        assert.lengthOf(log.args.on[7], 2)
        assert.strictEqual(log.args.on[7][0], 'end-obj')
        assert.isFunction(log.args.on[7][1])
        assert.strictEqual(log.args.on[7][1], log.args.on[6][1])
      })

      test('EventEmitter.on was called correctly ninth time', () => {
        assert.lengthOf(log.args.on[8], 2)
        assert.strictEqual(log.args.on[8][0], 'end')
        assert.isFunction(log.args.on[8][1])
        assert.notStrictEqual(log.args.on[8][1], log.args.on[0][1])
        assert.notStrictEqual(log.args.on[8][1], log.args.on[1][1])
        assert.notStrictEqual(log.args.on[8][1], log.args.on[2][1])
        assert.notStrictEqual(log.args.on[8][1], log.args.on[3][1])
        assert.notStrictEqual(log.args.on[8][1], log.args.on[6][1])
      })

      test('EventEmitter.on was called correctly tenth time', () => {
        assert.lengthOf(log.args.on[9], 2)
        assert.strictEqual(log.args.on[9][0], 'err')
        assert.isFunction(log.args.on[9][1])
        assert.notStrictEqual(log.args.on[9][1], log.args.on[0][1])
        assert.notStrictEqual(log.args.on[9][1], log.args.on[1][1])
        assert.notStrictEqual(log.args.on[9][1], log.args.on[2][1])
        assert.notStrictEqual(log.args.on[9][1], log.args.on[3][1])
        assert.notStrictEqual(log.args.on[9][1], log.args.on[6][1])
        assert.notStrictEqual(log.args.on[9][1], log.args.on[8][1])
      })

      test('EventEmitter.on was called correctly eleventh time', () => {
        assert.lengthOf(log.args.on[10], 2)
        assert.strictEqual(log.args.on[10][0], 'err-data')
        assert.isFunction(log.args.on[10][1])
        assert.strictEqual(log.args.on[10][1], log.args.on[9][1])
      })

      suite('array event:', () => {
        setup(() => {
          log.args.on[0][1]()
        })

        test('resolve was not called', () => {
          assert.strictEqual(log.counts.resolve, 0)
        })

        suite('end event:', () => {
          setup(done => {
            log.args.on[8][1]()
            setImmediate(done)
          })

          test('resolve was called once', () => {
            assert.strictEqual(log.counts.resolve, 1)
          })

          test('resolve was called correctly', () => {
            assert.isUndefined(log.these.resolve[0])
            assert.lengthOf(log.args.resolve[0], 1)
            assert.isArray(log.args.resolve[0][0])
            assert.lengthOf(log.args.resolve[0][0], 0)
          })

          test('reject was not called', () => {
            assert.strictEqual(log.counts.reject, 0)
          })
        })

        suite('string event:', () => {
          setup(() => {
            log.args.on[3][1]('foo')
          })

          test('resolve was not called', () => {
            assert.strictEqual(log.counts.resolve, 0)
          })

          suite('end event:', () => {
            setup(done => {
              log.args.on[8][1]()
              setImmediate(done)
            })

            test('resolve was called once', () => {
              assert.strictEqual(log.counts.resolve, 1)
            })

            test('resolve was called correctly', () => {
              assert.lengthOf(log.args.resolve[0], 1)
              assert.isArray(log.args.resolve[0][0])
              assert.lengthOf(log.args.resolve[0][0], 1)
              assert.strictEqual(log.args.resolve[0][0][0], 'foo')
            })
          })

          suite('string event:', () => {
            setup(() => {
              log.args.on[3][1]('bar')
            })

            test('resolve was not called', () => {
              assert.strictEqual(log.counts.resolve, 0)
            })

            suite('end event:', () => {
              setup(done => {
                log.args.on[8][1]()
                setImmediate(done)
              })

              test('resolve was called once', () => {
                assert.strictEqual(log.counts.resolve, 1)
              })

              test('resolve was called correctly', () => {
                assert.lengthOf(log.args.resolve[0][0], 2)
                assert.strictEqual(log.args.resolve[0][0][0], 'foo')
                assert.strictEqual(log.args.resolve[0][0][1], 'bar')
              })
            })
          })

          suite('array event:', () => {
            setup(() => {
              log.args.on[0][1]()
            })

            test('resolve was not called', () => {
              assert.strictEqual(log.counts.resolve, 0)
            })

            suite('end event:', () => {
              setup(done => {
                log.args.on[8][1]()
                setImmediate(done)
              })

              test('resolve was called once', () => {
                assert.strictEqual(log.counts.resolve, 1)
              })

              test('resolve was called correctly', () => {
                assert.lengthOf(log.args.resolve[0][0], 2)
                assert.strictEqual(log.args.resolve[0][0][0], 'foo')
                assert.isArray(log.args.resolve[0][0][1])
                assert.lengthOf(log.args.resolve[0][0][1], 0)
              })
            })

            suite('string event:', () => {
              setup(() => {
                log.args.on[3][1]('bar')
              })

              test('resolve was not called', () => {
                assert.strictEqual(log.counts.resolve, 0)
              })

              suite('end event:', () => {
                setup(done => {
                  log.args.on[8][1]()
                  setImmediate(done)
                })

                test('resolve was called once', () => {
                  assert.strictEqual(log.counts.resolve, 1)
                })

                test('resolve was called correctly', () => {
                  assert.lengthOf(log.args.resolve[0][0], 2)
                  assert.strictEqual(log.args.resolve[0][0][0], 'foo')
                  assert.isArray(log.args.resolve[0][0][1])
                  assert.lengthOf(log.args.resolve[0][0][1], 1)
                  assert.strictEqual(log.args.resolve[0][0][1][0], 'bar')
                })
              })

              suite('string event:', () => {
                setup(() => {
                  log.args.on[3][1]('baz')
                })

                test('resolve was not called', () => {
                  assert.strictEqual(log.counts.resolve, 0)
                })

                suite('end event:', () => {
                  setup(done => {
                    log.args.on[8][1]()
                    setImmediate(done)
                  })

                  test('resolve was called once', () => {
                    assert.strictEqual(log.counts.resolve, 1)
                  })

                  test('resolve was called correctly', () => {
                    assert.lengthOf(log.args.resolve[0][0], 2)
                    assert.strictEqual(log.args.resolve[0][0][0], 'foo')
                    assert.isArray(log.args.resolve[0][0][1])
                    assert.lengthOf(log.args.resolve[0][0][1], 2)
                    assert.strictEqual(log.args.resolve[0][0][1][0], 'bar')
                    assert.strictEqual(log.args.resolve[0][0][1][1], 'baz')
                  })
                })
              })

              suite('endArray event:', () => {
                setup(() => {
                  log.args.on[6][1]()
                })

                suite('string event:', () => {
                  setup(() => {
                    log.args.on[3][1]('baz')
                  })

                  test('resolve was not called', () => {
                    assert.strictEqual(log.counts.resolve, 0)
                  })

                  suite('end event:', () => {
                    setup(done => {
                      log.args.on[8][1]()
                      setImmediate(done)
                    })

                    test('resolve was called once', () => {
                      assert.strictEqual(log.counts.resolve, 1)
                    })

                    test('resolve was called correctly', () => {
                      assert.lengthOf(log.args.resolve[0][0], 3)
                      assert.strictEqual(log.args.resolve[0][0][0], 'foo')
                      assert.isArray(log.args.resolve[0][0][1])
                      assert.lengthOf(log.args.resolve[0][0][1], 1)
                      assert.strictEqual(log.args.resolve[0][0][1][0], 'bar')
                      assert.strictEqual(log.args.resolve[0][0][2], 'baz')
                    })
                  })
                })
              })
            })
          })

          suite('object event:', () => {
            setup(() => {
              log.args.on[1][1]()
            })

            test('resolve was not called', () => {
              assert.strictEqual(log.counts.resolve, 0)
            })

            suite('end event:', () => {
              setup(done => {
                log.args.on[8][1]()
                setImmediate(done)
              })

              test('resolve was called once', () => {
                assert.strictEqual(log.counts.resolve, 1)
              })

              test('resolve was called correctly', () => {
                assert.lengthOf(log.args.resolve[0][0], 2)
                assert.strictEqual(log.args.resolve[0][0][0], 'foo')
                assert.isObject(log.args.resolve[0][0][1])
                assert.lengthOf(Object.keys(log.args.resolve[0][0][1]), 0)
              })
            })

            suite('property event:', () => {
              setup(() => {
                log.args.on[2][1]('bar')
              })

              suite('string event:', () => {
                setup(() => {
                  log.args.on[3][1]('baz')
                })

                test('resolve was not called', () => {
                  assert.strictEqual(log.counts.resolve, 0)
                })

                suite('end event:', () => {
                  setup(done => {
                    log.args.on[8][1]()
                    setImmediate(done)
                  })

                  test('resolve was called once', () => {
                    assert.strictEqual(log.counts.resolve, 1)
                  })

                  test('resolve was called correctly', () => {
                    assert.lengthOf(log.args.resolve[0][0], 2)
                    assert.strictEqual(log.args.resolve[0][0][0], 'foo')
                    assert.isObject(log.args.resolve[0][0][1])
                    assert.lengthOf(Object.keys(log.args.resolve[0][0][1]), 1)
                    assert.strictEqual(log.args.resolve[0][0][1].bar, 'baz')
                  })
                })

                suite('property event:', () => {
                  setup(() => {
                    log.args.on[2][1]('qux')
                  })

                  suite('string event:', () => {
                    setup(() => {
                      log.args.on[3][1]('wibble')
                    })

                    test('resolve was not called', () => {
                      assert.strictEqual(log.counts.resolve, 0)
                    })

                    suite('end event:', () => {
                      setup(done => {
                        log.args.on[8][1]()
                        setImmediate(done)
                      })

                      test('resolve was called once', () => {
                        assert.strictEqual(log.counts.resolve, 1)
                      })

                      test('resolve was called correctly', () => {
                        assert.lengthOf(log.args.resolve[0][0], 2)
                        assert.strictEqual(log.args.resolve[0][0][0], 'foo')
                        assert.isObject(log.args.resolve[0][0][1])
                        assert.lengthOf(Object.keys(log.args.resolve[0][0][1]), 2)
                        assert.strictEqual(log.args.resolve[0][0][1].bar, 'baz')
                        assert.strictEqual(log.args.resolve[0][0][1].qux, 'wibble')
                      })
                    })
                  })
                })

                suite('endObject event:', () => {
                  setup(() => {
                    log.args.on[7][1]()
                  })

                  suite('string event:', () => {
                    setup(() => {
                      log.args.on[3][1]('wibble')
                    })

                    test('resolve was not called', () => {
                      assert.strictEqual(log.counts.resolve, 0)
                    })

                    suite('end event:', () => {
                      setup(done => {
                        log.args.on[8][1]()
                        setImmediate(done)
                      })

                      test('resolve was called once', () => {
                        assert.strictEqual(log.counts.resolve, 1)
                      })

                      test('resolve was called correctly', () => {
                        assert.lengthOf(log.args.resolve[0][0], 3)
                        assert.strictEqual(log.args.resolve[0][0][0], 'foo')
                        assert.isObject(log.args.resolve[0][0][1])
                        assert.lengthOf(Object.keys(log.args.resolve[0][0][1]), 1)
                        assert.strictEqual(log.args.resolve[0][0][1].bar, 'baz')
                        assert.strictEqual(log.args.resolve[0][0][2], 'wibble')
                      })
                    })
                  })
                })
              })
            })
          })
        })

        suite('error event:', () => {
          setup(() => {
            log.args.on[9][1]('foo')
          })

          test('reject was not called', () => {
            assert.strictEqual(log.counts.reject, 0)
          })

          suite('end event:', () => {
            setup(done => {
              log.args.on[8][1]()
              setImmediate(done)
            })

            test('reject was called once', () => {
              assert.strictEqual(log.counts.reject, 1)
            })

            test('reject was called correctly', () => {
              assert.isUndefined(log.these.reject[0])
              assert.lengthOf(log.args.reject[0], 1)
              assert.strictEqual(log.args.reject[0][0], 'foo')
            })
          })

          suite('error event:', () => {
            setup(() => {
              log.args.on[9][1]('bar')
            })

            test('reject was not called', () => {
              assert.strictEqual(log.counts.reject, 0)
            })

            suite('end event:', () => {
              setup(done => {
                log.args.on[8][1]()
                setImmediate(done)
              })

              test('reject was called once', () => {
                assert.strictEqual(log.counts.reject, 1)
              })

              test('reject was called correctly', () => {
                assert.strictEqual(log.args.reject[0][0], 'foo')
              })
            })
          })
        })
      })

      suite('object event:', () => {
        setup(() => {
          log.args.on[1][1]()
        })

        test('resolve was not called', () => {
          assert.strictEqual(log.counts.resolve, 0)
        })

        suite('end event:', () => {
          setup(done => {
            log.args.on[8][1]()
            setImmediate(done)
          })

          test('resolve was called once', () => {
            assert.strictEqual(log.counts.resolve, 1)
          })

          test('resolve was called correctly', () => {
            assert.isObject(log.args.resolve[0][0])
            assert.lengthOf(Object.keys(log.args.resolve[0][0]), 0)
          })
        })
      })
    })

    suite('parse with reviver:', () => {
      let stream, options

      setup(() => {
        stream = {}
        options = { reviver: spooks.fn({ name: 'reviver', log: log, results: [ 'reviver result' ] }) }
        parse(stream, options)
          .then(spooks.fn({ name: 'resolve', log: log }))
          .catch(spooks.fn({ name: 'reject', log: log }))
      })

      test('walk was called once', () => {
        assert.strictEqual(log.counts.walk, 1)
      })

      test('EventEmitter.on was called eleven times', () => {
        assert.strictEqual(log.counts.on, 11)
      })

      suite('populated array events:', () => {
        setup(() => {
          log.args.on[0][1]()
          log.args.on[3][1]('foo')
          log.args.on[3][1]('bar')
          log.args.on[0][1]()
          log.args.on[0][1]()
          log.args.on[3][1]('baz')
          log.args.on[6][1]()
          log.args.on[3][1]('qux')
          log.args.on[6][1]()
          log.args.on[6][1]()
        })

        test('resolve was not called', () => {
          assert.strictEqual(log.counts.resolve, 0)
        })

        test('reviver was not called', () => {
          assert.strictEqual(log.counts.resolve, 0)
        })

        suite('end event:', () => {
          setup(done => {
            log.args.on[8][1]()
            setImmediate(done)
          })

          test('resolve was called once', () => {
            assert.strictEqual(log.counts.resolve, 1)
          })

          test('reviver was called six times', () => {
            assert.strictEqual(log.counts.reviver, 7)
          })

          test('reviver was called correctly first time', () => {
            assert.lengthOf(log.args.reviver[0], 2)
            assert.strictEqual(log.args.reviver[0][0], '0')
            assert.strictEqual(log.args.reviver[0][1], 'foo')
          })

          test('reviver was called correctly second time', () => {
            assert.strictEqual(log.args.reviver[1][0], '1')
            assert.strictEqual(log.args.reviver[1][1], 'bar')
          })

          test('reviver was called correctly third time', () => {
            assert.strictEqual(log.args.reviver[2][0], '0')
            assert.strictEqual(log.args.reviver[2][1], 'baz')
          })

          test('reviver was called correctly fourth time', () => {
            assert.strictEqual(log.args.reviver[3][0], '0')
            assert.isArray(log.args.reviver[3][1])
            assert.lengthOf(log.args.reviver[3][1], 1)
            assert.strictEqual(log.args.reviver[3][1][0], 'reviver result')
          })

          test('reviver was called correctly fifth time', () => {
            assert.strictEqual(log.args.reviver[4][0], '1')
            assert.strictEqual(log.args.reviver[4][1], 'qux')
          })

          test('reviver was called correctly sixth time', () => {
            assert.strictEqual(log.args.reviver[5][0], '2')
            assert.isArray(log.args.reviver[5][1])
            assert.lengthOf(log.args.reviver[5][1], 2)
            assert.strictEqual(log.args.reviver[5][1][0], 'reviver result')
            assert.strictEqual(log.args.reviver[5][1][1], 'reviver result')
          })

          test('reviver was called correctly seventh time', () => {
            assert.strictEqual(log.args.reviver[6][0], '')
            assert.isArray(log.args.reviver[6][1])
            assert.lengthOf(log.args.reviver[6][1], 3)
            assert.strictEqual(log.args.reviver[6][1][0], 'reviver result')
            assert.strictEqual(log.args.reviver[6][1][1], 'reviver result')
            assert.strictEqual(log.args.reviver[6][1][2], 'reviver result')
          })
        })
      })

      suite('populated object events:', () => {
        setup(() => {
          log.args.on[1][1]()
          log.args.on[2][1]('foo')
          log.args.on[1][1]()
          log.args.on[2][1]('bar')
          log.args.on[4][1](3.14159265359)
          log.args.on[7][1]()
          log.args.on[2][1]('baz')
          log.args.on[5][1](null)
          log.args.on[7][1]()
        })

        test('resolve was not called', () => {
          assert.strictEqual(log.counts.resolve, 0)
        })

        test('reviver was not called', () => {
          assert.strictEqual(log.counts.resolve, 0)
        })

        suite('end event:', () => {
          setup(done => {
            log.args.on[8][1]()
            setImmediate(done)
          })

          test('resolve was called once', () => {
            assert.strictEqual(log.counts.resolve, 1)
          })

          test('reviver was called four times', () => {
            assert.strictEqual(log.counts.reviver, 4)
          })

          test('reviver was called correctly first time', () => {
            assert.lengthOf(log.args.reviver[0], 2)
            assert.strictEqual(log.args.reviver[0][0], 'bar')
            assert.strictEqual(log.args.reviver[0][1], 3.14159265359)
          })

          test('reviver was called correctly second time', () => {
            assert.strictEqual(log.args.reviver[1][0], 'foo')
            assert.isObject(log.args.reviver[1][1])
            assert.lengthOf(Object.keys(log.args.reviver[1][1]), 1)
            assert.strictEqual(log.args.reviver[1][1].bar, 'reviver result')
          })

          test('reviver was called correctly third time', () => {
            assert.strictEqual(log.args.reviver[2][0], 'baz')
            assert.isNull(log.args.reviver[2][1])
          })

          test('reviver was called correctly fourth time', () => {
            assert.strictEqual(log.args.reviver[3][0], '')
            assert.isObject(log.args.reviver[3][1])
            assert.lengthOf(Object.keys(log.args.reviver[3][1]), 2)
            assert.strictEqual(log.args.reviver[3][1].foo, 'reviver result')
            assert.strictEqual(log.args.reviver[3][1].baz, 'reviver result')
          })
        })
      })
    })

    suite('parse with ndjson:', () => {
      let stream

      setup(() => {
        stream = {}
        parse(stream, { ndjson: true })
          .then(spooks.fn({ name: 'resolve', log: log }))
          .catch(spooks.fn({ name: 'reject', log: log }))
      })

      test('walk was called once', () => {
        assert.strictEqual(log.counts.walk, 1)
      })

      test('EventEmitter.on was called twelve times', () => {
        assert.strictEqual(log.counts.on, 12)
        assert.strictEqual(log.these.on[11], results.walk[0])
      })

      test('EventEmitter.on was called correctly first eleven times', () => {
        assert.strictEqual(log.args.on[0][0], 'arr')
        assert.strictEqual(log.args.on[1][0], 'obj')
        assert.strictEqual(log.args.on[2][0], 'pro')
        assert.strictEqual(log.args.on[3][0], 'str')
        assert.strictEqual(log.args.on[4][0], 'num')
        assert.strictEqual(log.args.on[5][0], 'lit')
        assert.strictEqual(log.args.on[6][0], 'end-arr')
        assert.strictEqual(log.args.on[7][0], 'end-obj')
        assert.strictEqual(log.args.on[8][0], 'end')
        assert.strictEqual(log.args.on[9][0], 'err')
        assert.strictEqual(log.args.on[10][0], 'err-data')
      })

      test('EventEmitter.on was called correctly twelfth time', () => {
        assert.lengthOf(log.args.on[11], 2)
        assert.strictEqual(log.args.on[11][0], 'end-line')
        assert.isFunction(log.args.on[11][1])
        assert.notStrictEqual(log.args.on[11][1], log.args.on[0][1])
        assert.notStrictEqual(log.args.on[11][1], log.args.on[1][1])
        assert.notStrictEqual(log.args.on[11][1], log.args.on[2][1])
        assert.notStrictEqual(log.args.on[11][1], log.args.on[3][1])
        assert.notStrictEqual(log.args.on[11][1], log.args.on[6][1])
        assert.notStrictEqual(log.args.on[11][1], log.args.on[8][1])
        assert.notStrictEqual(log.args.on[11][1], log.args.on[9][1])
      })

      test('emitter.pause was not called', () => {
        assert.strictEqual(log.counts.pause, 0)
      })

      test('emitter.removeAllListeners was not called', () => {
        assert.strictEqual(log.counts.removeAllListeners, 0)
      })

      suite('array, endArray, endLine:', () => {
        setup(done => {
          log.args.on[0][1]()
          log.args.on[6][1]()
          log.args.on[11][1]()
          setImmediate(done)
        })

        test('resolve was called once', () => {
          assert.strictEqual(log.counts.resolve, 1)
        })

        test('resolve was called correctly', () => {
          assert.lengthOf(log.args.resolve[0], 1)
          assert.isArray(log.args.resolve[0][0])
          assert.lengthOf(log.args.resolve[0][0], 0)
        })

        test('emitter.pause was called once', () => {
          assert.strictEqual(log.counts.pause, 1)
        })

        test('emitter.pause was called correctly', () => {
          assert.lengthOf(log.args.pause[0], 0)
        })

        test('emitter.removeAllListeners was called once', () => {
          assert.strictEqual(log.counts.removeAllListeners, 1)
        })

        test('emitter.removeAllListeners was called correctly', () => {
          assert.lengthOf(log.args.removeAllListeners[0], 0)
        })

        test('reject was not called', () => {
          assert.strictEqual(log.counts.reject, 0)
        })

        suite('parse with ndjson:', () => {
          setup(() => {
            parse(stream, { ndjson: true })
              .then(spooks.fn({ name: 'resolve2', log: log }))
              .catch(spooks.fn({ name: 'reject2', log: log }))
          })

          test('EventEmitter.on was called twelve times', () => {
            assert.strictEqual(log.counts.on, 24)
          })

          test('walk was not called', () => {
            assert.strictEqual(log.counts.walk, 1)
          })

          suite('string, end:', () => {
            setup(done => {
              log.args.on[15][1]('foo')
              log.args.on[20][1]()
              setImmediate(done)
            })

            test('resolve was called once', () => {
              assert.strictEqual(log.counts.resolve, 1)
              assert.strictEqual(log.counts.resolve2, 1)
            })

            test('resolve was called correctly', () => {
              assert.lengthOf(log.args.resolve2[0], 1)
              assert.strictEqual(log.args.resolve2[0][0], 'foo')
            })

            test('emitter.pause was called once', () => {
              assert.strictEqual(log.counts.pause, 2)
            })

            test('emitter.removeAllListeners was called once', () => {
              assert.strictEqual(log.counts.removeAllListeners, 2)
            })

            test('reject was not called', () => {
              assert.strictEqual(log.counts.reject, 0)
              assert.strictEqual(log.counts.reject2, 0)
            })

            suite('parse with ndjson:', () => {
              setup(() => {
                parse(stream, { ndjson: true })
                  .then(spooks.fn({ name: 'resolve3', log: log }))
                  .catch(spooks.fn({ name: 'reject3', log: log }))
              })

              test('EventEmitter.on was called twelve times', () => {
                assert.strictEqual(log.counts.on, 36)
              })

              test('walk was not called', () => {
                assert.strictEqual(log.counts.walk, 1)
              })

              suite('end:', () => {
                setup(done => {
                  log.args.on[32][1]()
                  setImmediate(done)
                })

                test('resolve was called once', () => {
                  assert.strictEqual(log.counts.resolve, 1)
                  assert.strictEqual(log.counts.resolve2, 1)
                  assert.strictEqual(log.counts.resolve3, 1)
                })

                test('resolve was called correctly', () => {
                  assert.lengthOf(log.args.resolve3[0], 1)
                  assert.strictEqual(log.args.resolve3[0][0], undefined)
                })

                test('emitter.pause was called once', () => {
                  assert.strictEqual(log.counts.pause, 3)
                })

                test('emitter.removeAllListeners was called once', () => {
                  assert.strictEqual(log.counts.removeAllListeners, 3)
                })

                test('reject was not called', () => {
                  assert.strictEqual(log.counts.reject, 0)
                  assert.strictEqual(log.counts.reject2, 0)
                  assert.strictEqual(log.counts.reject3, 0)
                })
              })
            })
          })
        })

        suite('parse with ndjson and fresh stream:', () => {
          setup(() => {
            parse({}, { ndjson: true })
              .then(spooks.fn({ name: 'resolve2', log: log }))
              .catch(spooks.fn({ name: 'reject2', log: log }))
          })

          test('EventEmitter.on was called twelve times', () => {
            assert.strictEqual(log.counts.on, 24)
          })

          test('walk was called once', () => {
            assert.strictEqual(log.counts.walk, 2)
          })
        })
      })
    })
  })
})
