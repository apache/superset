'use strict'

const assert = require('chai').assert
const proxyquire = require('proxyquire')
const spooks = require('spooks')

const modulePath = '../../src/match'

suite('match:', () => {
  test('require does not throw', () => {
    assert.doesNotThrow(() => {
      require(modulePath)
    })
  })

  test('require returns function', () => {
    assert.isFunction(require(modulePath))
  })

  suite('require, results.push returns true:', () => {
    let log, resume, results, match

    setup(() => {
      log = {}
      resume = spooks.fn({ name: 'resume', log })
      results = {
        walk: [
          {
            on: spooks.fn({ name: 'on', log: log }),
            pause: spooks.fn({ name: 'pause', log: log, results: [ resume ] })
          }
        ],
        push: [ true ]
      }
      match = proxyquire(modulePath, {
        './walk': spooks.fn({
          name: 'walk',
          log: log,
          results: results.walk
        }),
        './datastream': spooks.ctor({
          name: 'DataStream',
          log: log,
          archetype: { instance: { push: () => {}, emit: () => {} } },
          results: results
        })
      })
    })

    test('match expects two arguments', () => {
      assert.lengthOf(match, 2)
    })

    test('match does not throw with match function', () => {
      assert.doesNotThrow(() => match(null, () => {}))
    })

    test('match does not throw with match string', () => {
      assert.doesNotThrow(() => match(null, ' '))
    })

    test('match throws with empty match string', () => {
      assert.throws(() => match(null, ''))
    })

    test('match does not throw with match regex', () => {
      assert.doesNotThrow(() => match(null, /.*/))
    })

    test('match throws with invalid match arg', () => {
      assert.throws(() => match(null, {}))
    })

    test('match returns stream', () => {
      assert.isFunction(match(null, /.*/).push)
      assert.isFunction(match(null, /.*/).emit)
    })

    test('DataStream was not called', () => {
      assert.strictEqual(log.counts.DataStream, 0)
    })

    test('walk was not called', () => {
      assert.strictEqual(log.counts.walk, 0)
    })

    test('EventEmitter.on was not called', () => {
      assert.strictEqual(log.counts.on, 0)
    })

    test('EventEmitter.pause was not called', () => {
      assert.strictEqual(log.counts.pause, 0)
    })

    suite('match with predicate returning true:', () => {
      let stream, predicate, options, result

      setup(() => {
        stream = {}
        predicate = spooks.fn({ name: 'predicate', log, results: [ true ] })
        options = { foo: 'bar', highWaterMark: 42 }
        result = match(stream, predicate, options)
      })

      test('DataStream was called once', () => {
        assert.strictEqual(log.counts.DataStream, 1)
        assert.isObject(log.these.DataStream[0])
      })

      test('DataStream was called correctly', () => {
        assert.lengthOf(log.args.DataStream[0], 2)
        assert.isFunction(log.args.DataStream[0][0])
        assert.deepEqual(log.args.DataStream[0][1], { highWaterMark: 42 })
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
        assert.lengthOf(Object.keys(log.args.walk[0][1]), 2)
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
      })

      test('EventEmitter.on was called correctly third time', () => {
        assert.lengthOf(log.args.on[2], 2)
        assert.strictEqual(log.args.on[2][0], 'pro')
        assert.isFunction(log.args.on[2][1])
      })

      test('EventEmitter.on was called correctly fourth time', () => {
        assert.lengthOf(log.args.on[3], 2)
        assert.strictEqual(log.args.on[3][0], 'end-arr')
        assert.isFunction(log.args.on[3][1])
      })

      test('EventEmitter.on was called correctly fifth time', () => {
        assert.lengthOf(log.args.on[4], 2)
        assert.strictEqual(log.args.on[4][0], 'end-obj')
        assert.isFunction(log.args.on[4][1])
      })

      test('EventEmitter.on was called correctly sixth time', () => {
        assert.lengthOf(log.args.on[5], 2)
        assert.strictEqual(log.args.on[5][0], 'str')
        assert.isFunction(log.args.on[5][1])
      })

      test('EventEmitter.on was called correctly seventh time', () => {
        assert.lengthOf(log.args.on[6], 2)
        assert.strictEqual(log.args.on[6][0], 'num')
        assert.isFunction(log.args.on[6][1])
      })

      test('EventEmitter.on was called correctly eighth time', () => {
        assert.lengthOf(log.args.on[7], 2)
        assert.strictEqual(log.args.on[7][0], 'lit')
        assert.isFunction(log.args.on[7][1])
      })

      test('EventEmitter.on was called correctly ninth time', () => {
        assert.lengthOf(log.args.on[8], 2)
        assert.strictEqual(log.args.on[8][0], 'end')
        assert.isFunction(log.args.on[8][1])
      })

      test('EventEmitter.on was called correctly tenth time', () => {
        assert.lengthOf(log.args.on[9], 2)
        assert.strictEqual(log.args.on[9][0], 'err')
        assert.isFunction(log.args.on[9][1])
      })

      test('EventEmitter.on was called correctly eleventh time', () => {
        assert.lengthOf(log.args.on[10], 2)
        assert.strictEqual(log.args.on[10][0], 'err-data')
        assert.isFunction(log.args.on[10][1])
      })

      suite('array event:', () => {
        setup(() => {
          log.args.on[0][1]()
        })

        test('results.push was not called', () => {
          assert.strictEqual(log.counts.push, 0)
        })

        suite('end event:', () => {
          setup(() => {
            log.args.on[8][1]()
          })

          test('results.push was not called', () => {
            assert.strictEqual(log.counts.push, 0)
          })

          suite('read stream:', () => {
            setup(() => {
              log.args.DataStream[0][0]()
            })

            test('results.push was called once', () => {
              assert.strictEqual(log.counts.push, 1)
            })

            test('results.push was called correctly', () => {
              assert.lengthOf(log.args.push[0], 1)
              assert.isNull(log.args.push[0][0])
            })

            test('predicate was not called', () => {
              assert.strictEqual(log.counts.predicate, 0)
            })
          })
        })

        suite('endArray and end events:', () => {
          setup(() => {
            log.args.on[3][1]()
            log.args.on[8][1]()
          })

          test('predicate was called once', () => {
            assert.strictEqual(log.counts.predicate, 1)
          })

          test('predicate was called correctly', () => {
            assert.lengthOf(log.args.predicate[0], 3)
            assert.isUndefined(log.args.predicate[0][0])
            assert.deepEqual(log.args.predicate[0][1], [])
            assert.strictEqual(log.args.predicate[0][2], 0)
          })

          test('results.push was not called', () => {
            assert.strictEqual(log.counts.push, 0)
          })

          suite('read stream:', () => {
            setup(() => {
              log.args.DataStream[0][0]()
            })

            test('results.push was called twice', () => {
              assert.strictEqual(log.counts.push, 2)
            })

            test('results.push was called correctly first time', () => {
              assert.lengthOf(log.args.push[0], 1)
              assert.deepEqual(log.args.push[0][0], [])
            })

            test('results.push was called correctly second time', () => {
              assert.lengthOf(log.args.push[1], 1)
              assert.isNull(log.args.push[1][0])
            })

            test('results.emit was not called', () => {
              assert.strictEqual(log.counts.emit, 0)
            })
          })
        })

        suite('read stream:', () => {
          setup(() => {
            log.args.DataStream[0][0]()
          })

          test('results.push was not called', () => {
            assert.strictEqual(log.counts.push, 0)
          })

          suite('end event:', () => {
            setup(() => {
              log.args.on[8][1]()
            })

            test('results.push was called once', () => {
              assert.strictEqual(log.counts.push, 1)
            })

            test('results.push was called correctly', () => {
              assert.isNull(log.args.push[0][0])
            })

            test('results.emit was not called', () => {
              assert.strictEqual(log.counts.emit, 0)
            })
          })

          suite('dataError event:', () => {
            setup(() => {
              log.args.on[10][1]('foo')
            })

            test('results.push was not called', () => {
              assert.strictEqual(log.counts.push, 0)
            })

            test('results.emit was called once', () => {
              assert.strictEqual(log.counts.emit, 1)
            })

            test('results.emit was called correctly', () => {
              assert.lengthOf(log.args.emit[0], 2)
              assert.strictEqual(log.args.emit[0][0], 'dataError')
              assert.strictEqual(log.args.emit[0][1], 'foo')
            })

            test('predicate was not called', () => {
              assert.strictEqual(log.counts.predicate, 0)
            })
          })

          suite('string event:', () => {
            setup(() => {
              log.args.on[5][1]('foo')
            })

            test('predicate was called once', () => {
              assert.strictEqual(log.counts.predicate, 1)
            })

            test('predicate was called correctly', () => {
              assert.lengthOf(log.args.predicate[0], 3)
              assert.strictEqual(log.args.predicate[0][0], 0)
              assert.strictEqual(log.args.predicate[0][1], 'foo')
              assert.strictEqual(log.args.predicate[0][2], 1)
            })

            test('results.push was called once', () => {
              assert.strictEqual(log.counts.push, 1)
            })

            test('results.push was called correctly', () => {
              assert.strictEqual(log.args.push[0][0], 'foo')
            })

            suite('string event:', () => {
              setup(() => {
                log.args.on[5][1]('bar')
              })

              test('predicate was called once', () => {
                assert.strictEqual(log.counts.predicate, 2)
              })

              test('predicate was called correctly', () => {
                assert.strictEqual(log.args.predicate[1][0], 1)
                assert.strictEqual(log.args.predicate[1][1], 'bar')
                assert.strictEqual(log.args.predicate[1][2], 1)
              })

              test('results.push was called once', () => {
                assert.strictEqual(log.counts.push, 2)
              })

              test('results.push was called correctly', () => {
                assert.strictEqual(log.args.push[1][0], 'bar')
              })
            })

            suite('array event:', () => {
              setup(() => {
                log.args.on[0][1]()
              })

              test('predicate was not called', () => {
                assert.strictEqual(log.counts.predicate, 1)
              })

              test('results.push was not called', () => {
                assert.strictEqual(log.counts.push, 1)
              })

              suite('endArray event:', () => {
                setup(() => {
                  log.args.on[3][1]()
                })

                test('predicate was called once', () => {
                  assert.strictEqual(log.counts.predicate, 2)
                })

                test('predicate was called correctly', () => {
                  assert.strictEqual(log.args.predicate[1][0], 1)
                  assert.deepEqual(log.args.predicate[1][1], [])
                  assert.strictEqual(log.args.predicate[1][2], 1)
                })

                test('results.push was called once', () => {
                  assert.strictEqual(log.counts.push, 2)
                })

                test('results.push was called correctly', () => {
                  assert.deepEqual(log.args.push[1][0], [])
                })

                suite('endArray event:', () => {
                  setup(() => {
                    log.args.on[3][1]()
                  })

                  test('predicate was called once', () => {
                    assert.strictEqual(log.counts.predicate, 3)
                  })

                  test('predicate was called correctly', () => {
                    assert.isUndefined(log.args.predicate[2][0])
                    assert.deepEqual(log.args.predicate[2][1], [ 'foo', [] ])
                    assert.strictEqual(log.args.predicate[2][2], 0)
                  })

                  test('results.push was called once', () => {
                    assert.strictEqual(log.counts.push, 3)
                  })

                  test('results.push was called correctly', () => {
                    assert.deepEqual(log.args.push[2][0], [ 'foo', [] ])
                  })

                  test('EventEmitter.pause was not called', () => {
                    assert.strictEqual(log.counts.pause, 0)
                  })
                })
              })
            })

            suite('object event:', () => {
              setup(() => {
                log.args.on[1][1]()
              })

              test('results.push was not called', () => {
                assert.strictEqual(log.counts.push, 1)
              })

              suite('property event:', () => {
                setup(() => {
                  log.args.on[2][1]('bar')
                })

                test('predicate was not called', () => {
                  assert.strictEqual(log.counts.predicate, 1)
                })

                test('results.push was not called', () => {
                  assert.strictEqual(log.counts.push, 1)
                })

                suite('string event:', () => {
                  setup(() => {
                    log.args.on[5][1]('baz')
                  })

                  test('predicate was called once', () => {
                    assert.strictEqual(log.counts.predicate, 2)
                  })

                  test('predicate was called correctly', () => {
                    assert.strictEqual(log.args.predicate[1][0], 'bar')
                    assert.strictEqual(log.args.predicate[1][1], 'baz')
                    assert.strictEqual(log.args.predicate[1][2], 2)
                  })

                  test('results.push was called once', () => {
                    assert.strictEqual(log.counts.push, 2)
                  })

                  test('results.push was called correctly', () => {
                    assert.strictEqual(log.args.push[1][0], 'baz')
                  })

                  suite('property event:', () => {
                    setup(() => {
                      log.args.on[2][1]('nested')
                    })

                    test('results.push was not called', () => {
                      assert.strictEqual(log.counts.push, 2)
                    })

                    suite('object event:', () => {
                      setup(() => {
                        log.args.on[1][1]()
                      })

                      test('predicate was not called', () => {
                        assert.strictEqual(log.counts.predicate, 2)
                      })

                      test('results.push was not called', () => {
                        assert.strictEqual(log.counts.push, 2)
                      })

                      suite('endObject event:', () => {
                        setup(() => {
                          log.args.on[4][1]()
                        })

                        test('predicate was called once', () => {
                          assert.strictEqual(log.counts.predicate, 3)
                        })

                        test('predicate was called correctly', () => {
                          assert.strictEqual(log.args.predicate[2][0], 'nested')
                          assert.deepEqual(log.args.predicate[2][1], {})
                          assert.strictEqual(log.args.predicate[2][2], 2)
                        })

                        test('results.push was called once', () => {
                          assert.strictEqual(log.counts.push, 3)
                        })

                        test('results.push was called correctly', () => {
                          assert.deepEqual(log.args.push[2][0], {})
                        })

                        suite('endObject event:', () => {
                          setup(() => {
                            log.args.on[4][1]()
                          })

                          test('predicate was called once', () => {
                            assert.strictEqual(log.counts.predicate, 4)
                          })

                          test('predicate was called correctly', () => {
                            assert.strictEqual(log.args.predicate[3][0], 1)
                            assert.deepEqual(log.args.predicate[3][1], { bar: 'baz', nested: {} })
                            assert.strictEqual(log.args.predicate[3][2], 1)
                          })

                          test('results.push was called once', () => {
                            assert.strictEqual(log.counts.push, 4)
                          })

                          test('results.push was called correctly', () => {
                            assert.deepEqual(log.args.push[3][0], { bar: 'baz', nested: {} })
                          })

                          test('EventEmitter.pause was not called', () => {
                            assert.strictEqual(log.counts.pause, 0)
                          })
                        })
                      })
                    })
                  })
                })
              })
            })
          })

          suite('string events, push returns false:', () => {
            setup(() => {
              results.push[0] = false
              log.args.on[5][1]('foo')
              log.args.on[5][1]('bar')
            })

            teardown(() => {
              results.push[0] = true
            })

            test('predicate was called twice', () => {
              assert.strictEqual(log.counts.predicate, 2)
            })

            test('results.push was called once', () => {
              assert.strictEqual(log.counts.push, 1)
            })

            test('results.push was called correctly', () => {
              assert.strictEqual(log.args.push[0][0], 'foo')
            })

            test('emitter.pause was called once', () => {
              assert.strictEqual(log.counts.pause, 1)
              assert.strictEqual(log.these.pause[0], results.walk[0])
            })

            test('emitter.pause was called correctly', () => {
              assert.lengthOf(log.args.pause[0], 0)
            })

            test('resume was not called', () => {
              assert.strictEqual(log.counts.resume, 0)
            })

            suite('read stream:', () => {
              setup(() => {
                log.args.DataStream[0][0]()
              })

              test('resume was called once', () => {
                assert.strictEqual(log.counts.resume, 1)
                assert.isUndefined(log.these.resume[0])
              })

              test('resume was called correctly', () => {
                assert.lengthOf(log.args.resume[0], 0)
              })

              test('results.push was called once', () => {
                assert.strictEqual(log.counts.push, 2)
              })

              test('results.push was called correctly', () => {
                assert.strictEqual(log.args.push[1][0], 'bar')
              })
            })
          })
        })

        suite('all events then read:', () => {
          setup(() => {
            log.args.on[1][1]()
            log.args.on[2][1]('foo')
            log.args.on[5][1]('bar')
            log.args.on[4][1]()
            log.args.on[5][1]('')
            log.args.on[6][1](0)
            log.args.on[7][1](null)
            log.args.on[7][1](false)
            log.args.on[3][1]()
            log.args.on[8][1]()
            log.args.DataStream[0][0]()
          })

          test('predicate was called six times', () => {
            assert.strictEqual(log.counts.predicate, 6)
          })

          test('predicate was called correctly first time', () => {
            assert.strictEqual(log.args.predicate[0][0], 'foo')
            assert.strictEqual(log.args.predicate[0][1], 'bar')
            assert.strictEqual(log.args.predicate[0][2], 2)
          })

          test('predicate was called correctly second time', () => {
            assert.strictEqual(log.args.predicate[1][0], 0)
            assert.deepEqual(log.args.predicate[1][1], { foo: 'bar' })
            assert.strictEqual(log.args.predicate[1][2], 1)
          })

          test('predicate was called correctly third time', () => {
            assert.strictEqual(log.args.predicate[2][0], 1)
            assert.strictEqual(log.args.predicate[2][1], '')
            assert.strictEqual(log.args.predicate[2][2], 1)
          })

          test('predicate was called correctly fourth time', () => {
            assert.strictEqual(log.args.predicate[3][0], 2)
            assert.strictEqual(log.args.predicate[3][1], 0)
            assert.strictEqual(log.args.predicate[3][2], 1)
          })

          test('predicate was called correctly fifth time', () => {
            assert.strictEqual(log.args.predicate[4][0], 4)
            assert.strictEqual(log.args.predicate[4][1], false)
            assert.strictEqual(log.args.predicate[4][2], 1)
          })

          test('predicate was called correctly sixth time', () => {
            assert.isUndefined(log.args.predicate[5][0])
            assert.deepEqual(log.args.predicate[5][1], [ { foo: 'bar' }, '', 0, null, false ])
            assert.strictEqual(log.args.predicate[5][2], 0)
          })

          test('results.push was called seven times', () => {
            assert.strictEqual(log.counts.push, 7)
          })

          test('results.push was called correctly', () => {
            assert.strictEqual(log.args.push[0][0], 'bar')
            assert.deepEqual(log.args.push[1][0], { foo: 'bar' })
            assert.strictEqual(log.args.push[2][0], '')
            assert.strictEqual(log.args.push[3][0], 0)
            assert.strictEqual(log.args.push[4][0], false)
            assert.deepEqual(log.args.push[5][0], [ { foo: 'bar' }, '', 0, null, false ])
            assert.isNull(log.args.push[6][0])
          })

          test('results.emit was not called', () => {
            assert.strictEqual(log.counts.emit, 0)
          })
        })
      })

      suite('read then all events:', () => {
        setup(() => {
          log.args.DataStream[0][0]()
          log.args.on[0][1]()
          log.args.on[1][1]()
          log.args.on[2][1]('foo')
          log.args.on[5][1]('bar')
          log.args.on[4][1]()
          log.args.on[5][1]('')
          log.args.on[6][1](0)
          log.args.on[7][1](null)
          log.args.on[7][1](false)
          log.args.on[3][1]()
          log.args.on[8][1]()
        })

        test('results.push was called seven times', () => {
          assert.strictEqual(log.counts.push, 7)
        })

        test('results.push was called correctly', () => {
          assert.strictEqual(log.args.push[0][0], 'bar')
          assert.deepEqual(log.args.push[1][0], { foo: 'bar' })
          assert.strictEqual(log.args.push[2][0], '')
          assert.strictEqual(log.args.push[3][0], 0)
          assert.strictEqual(log.args.push[4][0], false)
          assert.deepEqual(log.args.push[5][0], [ { foo: 'bar' }, '', 0, null, false ])
          assert.isNull(log.args.push[6][0])
        })

        test('results.emit was not called', () => {
          assert.strictEqual(log.counts.emit, 0)
        })
      })
    })

    suite('match with predicate returning false:', () => {
      let stream, predicate, options, result

      setup(() => {
        predicate = spooks.fn({ name: 'predicate', log, results: [ false ] })
        result = match({}, predicate, {})
      })

      test('DataStream was called once', () => {
        assert.strictEqual(log.counts.DataStream, 1)
      })

      test('walk was called once', () => {
        assert.strictEqual(log.counts.walk, 1)
      })

      test('EventEmitter.on was called eleven times', () => {
        assert.strictEqual(log.counts.on, 11)
      })

      suite('read events:', () => {
        setup(() => {
          log.args.DataStream[0][0]()
          log.args.on[0][1]()
          log.args.on[1][1]()
          log.args.on[2][1]('foo')
          log.args.on[5][1]('bar')
          log.args.on[4][1]()
          log.args.on[5][1]('baz')
          log.args.on[6][1](1)
          log.args.on[7][1](true)
          log.args.on[3][1]()
          log.args.on[8][1]()
        })

        test('results.push was called once', () => {
          assert.strictEqual(log.counts.push, 1)
        })

        test('results.push was called correctly', () => {
          assert.isNull(log.args.push[0][0])
        })

        test('results.emit was not called', () => {
          assert.strictEqual(log.counts.emit, 0)
        })
      })
    })

    suite('match with string:', () => {
      let stream, options, result

      setup(() => {
        result = match({}, 'foo', {})
      })

      test('DataStream was called once', () => {
        assert.strictEqual(log.counts.DataStream, 1)
      })

      test('walk was called once', () => {
        assert.strictEqual(log.counts.walk, 1)
      })

      test('EventEmitter.on was called eleven times', () => {
        assert.strictEqual(log.counts.on, 11)
      })

      suite('read events:', () => {
        setup(() => {
          log.args.DataStream[0][0]()
          log.args.on[1][1]()
          log.args.on[2][1]('foo')
          log.args.on[5][1]('bar')
          log.args.on[2][1]('baz')
          log.args.on[5][1]('qux')
          log.args.on[2][1]('foo')
          log.args.on[5][1]('wibble')
          log.args.on[4][1]()
          log.args.on[8][1]()
        })

        test('results.push was called three times', () => {
          assert.strictEqual(log.counts.push, 3)
        })

        test('results.push was called correctly first time', () => {
          assert.strictEqual(log.args.push[0][0], 'bar')
        })

        test('results.push was called correctly second time', () => {
          assert.strictEqual(log.args.push[1][0], 'wibble')
        })

        test('results.push was called correctly third time', () => {
          assert.isNull(log.args.push[2][0])
        })

        test('results.emit was not called', () => {
          assert.strictEqual(log.counts.emit, 0)
        })
      })
    })

    suite('match with regular expression:', () => {
      let stream, options, result

      setup(() => {
        result = match({}, /oo/, {})
      })

      test('DataStream was called once', () => {
        assert.strictEqual(log.counts.DataStream, 1)
      })

      test('walk was called once', () => {
        assert.strictEqual(log.counts.walk, 1)
      })

      test('EventEmitter.on was called eleven times', () => {
        assert.strictEqual(log.counts.on, 11)
      })

      suite('read events:', () => {
        setup(() => {
          log.args.DataStream[0][0]()
          log.args.on[1][1]()
          log.args.on[2][1]('foo')
          log.args.on[5][1]('bar')
          log.args.on[2][1]('fo')
          log.args.on[5][1]('baz')
          log.args.on[2][1]('oo')
          log.args.on[5][1]('qux')
          log.args.on[4][1]()
          log.args.on[8][1]()
        })

        test('results.push was called three times', () => {
          assert.strictEqual(log.counts.push, 3)
        })

        test('results.push was called correctly first time', () => {
          assert.strictEqual(log.args.push[0][0], 'bar')
        })

        test('results.push was called correctly second time', () => {
          assert.strictEqual(log.args.push[1][0], 'qux')
        })

        test('results.push was called correctly third time', () => {
          assert.isNull(log.args.push[2][0])
        })

        test('results.emit was not called', () => {
          assert.strictEqual(log.counts.emit, 0)
        })
      })
    })

    suite('match with numbers=true:', () => {
      let stream, options, result

      setup(() => {
        result = match({}, '1', { numbers: true })
      })

      test('DataStream was called once', () => {
        assert.strictEqual(log.counts.DataStream, 1)
      })

      test('walk was called once', () => {
        assert.strictEqual(log.counts.walk, 1)
      })

      test('EventEmitter.on was called eleven times', () => {
        assert.strictEqual(log.counts.on, 11)
      })

      suite('read events:', () => {
        setup(() => {
          log.args.DataStream[0][0]()
          log.args.on[1][1]()
          log.args.on[2][1]('0')
          log.args.on[5][1]('foo')
          log.args.on[2][1]('1')
          log.args.on[5][1]('bar')
          log.args.on[2][1]('2')
          log.args.on[0][1]()
          log.args.on[5][1]('baz')
          log.args.on[5][1]('qux')
          log.args.on[3][1]()
          log.args.on[4][1]()
          log.args.on[8][1]()
        })

        test('results.push was called three times', () => {
          assert.strictEqual(log.counts.push, 3)
        })

        test('results.push was called correctly first time', () => {
          assert.strictEqual(log.args.push[0][0], 'bar')
        })

        test('results.push was called correctly second time', () => {
          assert.strictEqual(log.args.push[1][0], 'qux')
        })

        test('results.push was called correctly third time', () => {
          assert.isNull(log.args.push[2][0])
        })

        test('results.emit was not called', () => {
          assert.strictEqual(log.counts.emit, 0)
        })
      })
    })

    suite('match with bufferLength=3:', () => {
      let stream, options, result

      setup(() => {
        result = match({}, 'foo', { bufferLength: 3 })
      })

      test('DataStream was called once', () => {
        assert.strictEqual(log.counts.DataStream, 1)
      })

      test('walk was called once', () => {
        assert.strictEqual(log.counts.walk, 1)
      })

      test('EventEmitter.on was called eleven times', () => {
        assert.strictEqual(log.counts.on, 11)
      })

      suite('two matching events:', () => {
        setup(() => {
          log.args.on[1][1]()
          log.args.on[2][1]('foo')
          log.args.on[5][1]('bar')
          log.args.on[2][1]('baz')
          log.args.on[5][1]('qux')
          log.args.on[2][1]('foo')
          log.args.on[5][1]('wibble')
          log.args.on[2][1]('foo')
        })

        test('EventEmitter.pause was not called', () => {
          assert.strictEqual(log.counts.pause, 0)
        })

        suite('matching event:', () => {
          setup(() => {
            log.args.on[5][1]('blee')
          })

          test('results.push was not called', () => {
            assert.strictEqual(log.counts.push, 0)
          })

          test('EventEmitter.pause was called once', () => {
            assert.strictEqual(log.counts.pause, 1)
          })

          test('resume was not called', () => {
            assert.strictEqual(log.counts.resume, 0)
          })

          suite('read:', () => {
            setup(() => {
              log.args.DataStream[0][0]()
            })

            test('resume was called once', () => {
              assert.strictEqual(log.counts.resume, 1)
            })

            test('results.push was called three times', () => {
              assert.strictEqual(log.counts.push, 3)
            })

            test('results.push was called correctly first time', () => {
              assert.strictEqual(log.args.push[0][0], 'bar')
            })

            test('results.push was called correctly second time', () => {
              assert.strictEqual(log.args.push[1][0], 'wibble')
            })

            test('results.push was called correctly third time', () => {
              assert.strictEqual(log.args.push[2][0], 'blee')
            })

            test('results.emit was not called', () => {
              assert.strictEqual(log.counts.emit, 0)
            })
          })
        })
      })
    })
  })
})
