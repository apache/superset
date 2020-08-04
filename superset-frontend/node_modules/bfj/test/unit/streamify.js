'use strict'

const assert = require('chai').assert
const proxyquire = require('proxyquire')
const spooks = require('spooks')

const modulePath = '../../src/streamify'

suite('streamify:', () => {
  test('require does not throw', () => {
    assert.doesNotThrow(() => {
      require(modulePath)
    })
  })

  test('require returns function', () => {
    assert.isFunction(require(modulePath))
  })

  suite('require:', () => {
    let log, results, streamify

    setup(() => {
      log = {}
      results = {
        eventify: [
          { on: spooks.fn({ name: 'on', log: log }) }
        ],
        push: [ true ]
      }
      streamify = proxyquire(modulePath, {
        './eventify': spooks.fn({
          name: 'eventify',
          log: log,
          results: results.eventify
        }),
        './jsonstream': spooks.ctor({
          name: 'JsonStream',
          log: log,
          archetype: { instance: { push: () => {}, emit: () => {} } },
          results: results
        })
      })
    })

    test('streamify expects one argument', () => {
      assert.lengthOf(streamify, 1)
    })

    test('streamify does not throw', () => {
      assert.doesNotThrow(() => {
        streamify()
      })
    })

    test('streamify returns stream', () => {
      assert.isFunction(streamify().push)
      assert.isFunction(streamify().emit)
    })

    test('JsonStream was not called', () => {
      assert.strictEqual(log.counts.JsonStream, 0)
    })

    test('eventify was not called', () => {
      assert.strictEqual(log.counts.eventify, 0)
    })

    test('EventEmitter.on was not called', () => {
      assert.strictEqual(log.counts.on, 0)
    })

    suite('streamify:', () => {
      let data, options, result

      setup(() => {
        data = {}
        options = { foo: 'bar', highWaterMark: 42 }
        result = streamify(data, options)
      })

      test('JsonStream was called once', () => {
        assert.strictEqual(log.counts.JsonStream, 1)
        assert.isObject(log.these.JsonStream[0])
      })

      test('JsonStream was called correctly', () => {
        assert.lengthOf(log.args.JsonStream[0], 2)
        assert.isFunction(log.args.JsonStream[0][0])
        assert.deepEqual(log.args.JsonStream[0][1], { highWaterMark: 42 })
      })

      test('eventify was called once', () => {
        assert.strictEqual(log.counts.eventify, 1)
        assert.isUndefined(log.these.eventify[0])
      })

      test('eventify was called correctly', () => {
        assert.lengthOf(log.args.eventify[0], 2)
        assert.strictEqual(log.args.eventify[0][0], data)
        assert.lengthOf(Object.keys(log.args.eventify[0][0]), 0)
        assert.strictEqual(log.args.eventify[0][1], options)
        assert.lengthOf(Object.keys(log.args.eventify[0][1]), 2)
      })

      test('EventEmitter.on was called eleven times', () => {
        assert.strictEqual(log.counts.on, 11)
        assert.strictEqual(log.these.on[0], results.eventify[0])
        assert.strictEqual(log.these.on[1], results.eventify[0])
        assert.strictEqual(log.these.on[2], results.eventify[0])
        assert.strictEqual(log.these.on[3], results.eventify[0])
        assert.strictEqual(log.these.on[4], results.eventify[0])
        assert.strictEqual(log.these.on[5], results.eventify[0])
        assert.strictEqual(log.these.on[6], results.eventify[0])
        assert.strictEqual(log.these.on[7], results.eventify[0])
        assert.strictEqual(log.these.on[8], results.eventify[0])
        assert.strictEqual(log.these.on[9], results.eventify[0])
        assert.strictEqual(log.these.on[10], results.eventify[0])
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
        assert.strictEqual(log.args.on[3][0], 'str')
        assert.isFunction(log.args.on[3][1])
      })

      test('EventEmitter.on was called correctly fifth time', () => {
        assert.lengthOf(log.args.on[4], 2)
        assert.strictEqual(log.args.on[4][0], 'num')
        assert.isFunction(log.args.on[4][1])
      })

      test('EventEmitter.on was called correctly sixth time', () => {
        assert.lengthOf(log.args.on[5], 2)
        assert.strictEqual(log.args.on[5][0], 'lit')
        assert.isFunction(log.args.on[5][1])
      })

      test('EventEmitter.on was called correctly seventh time', () => {
        assert.lengthOf(log.args.on[6], 2)
        assert.strictEqual(log.args.on[6][0], 'end-arr')
        assert.isFunction(log.args.on[6][1])
      })

      test('EventEmitter.on was called correctly eighth time', () => {
        assert.lengthOf(log.args.on[7], 2)
        assert.strictEqual(log.args.on[7][0], 'end-obj')
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
          return log.args.on[0][1]()
        })

        test('stream.push was not called', () => {
          assert.strictEqual(log.counts.push, 0)
        })

        suite('end event:', () => {
          setup(() => {
            return log.args.on[8][1]()
          })

          test('stream.push was not called', () => {
            assert.strictEqual(log.counts.push, 0)
          })

          suite('read stream:', () => {
            setup(() => {
              log.args.JsonStream[0][0]()
            })

            test('stream.push was called twice', () => {
              assert.strictEqual(log.counts.push, 2)
            })

            test('stream.push was called correctly first time', () => {
              assert.lengthOf(log.args.push[0], 2)
              assert.strictEqual(log.args.push[0][0], '[')
              assert.strictEqual(log.args.push[0][1], 'utf8')
            })

            test('stream.push was called correctly second time', () => {
              assert.lengthOf(log.args.push[1], 1)
              assert.isNull(log.args.push[1][0])
            })

            test('stream.emit was not called', () => {
              assert.strictEqual(log.counts.emit, 0)
            })
          })
        })

        suite('read stream:', () => {
          setup(() => {
            log.args.JsonStream[0][0]()
          })

          test('stream.push was not called', () => {
            assert.strictEqual(log.counts.push, 0)
          })

          suite('end event:', () => {
            setup(() => {
              return log.args.on[8][1]()
            })

            test('stream.push was called twice', () => {
              assert.strictEqual(log.counts.push, 2)
            })

            test('stream.push was called correctly first time', () => {
              assert.strictEqual(log.args.push[0][0], '[')
            })

            test('stream.push was called correctly second time', () => {
              assert.isNull(log.args.push[1][0])
            })

            test('stream.emit was not called', () => {
              assert.strictEqual(log.counts.emit, 0)
            })
          })

          suite('string event:', () => {
            setup(() => {
              return log.args.on[3][1]('foo')
            })

            test('stream.push was called twice', () => {
              assert.strictEqual(log.counts.push, 2)
            })

            test('stream.push was called correctly', () => {
              assert.strictEqual(log.args.push[0][0], '[')
              assert.strictEqual(log.args.push[1][0], '"foo"')
            })

            suite('string event:', () => {
              setup(() => {
                return log.args.on[3][1]('bar')
              })

              test('stream.push was called twice', () => {
                assert.strictEqual(log.counts.push, 4)
              })

              test('stream.push was called correctly', () => {
                assert.strictEqual(log.args.push[2][0], ',')
                assert.strictEqual(log.args.push[3][0], '"bar"')
              })
            })

            suite('array event:', () => {
              setup(() => {
                return log.args.on[0][1]()
              })

              test('stream.push was called twice', () => {
                assert.strictEqual(log.counts.push, 4)
              })

              test('stream.push was called correctly', () => {
                assert.strictEqual(log.args.push[2][0], ',')
                assert.strictEqual(log.args.push[3][0], '[')
              })

              suite('array event:', () => {
                setup(() => {
                  return log.args.on[0][1]()
                })

                test('stream.push was called once', () => {
                  assert.strictEqual(log.counts.push, 5)
                })

                test('stream.push was called correctly', () => {
                  assert.strictEqual(log.args.push[4][0], '[')
                })

                suite('endArray event:', () => {
                  setup(() => {
                    return log.args.on[6][1]()
                  })

                  test('stream.push was called once', () => {
                    assert.strictEqual(log.counts.push, 6)
                  })

                  test('stream.push was called correctly', () => {
                    assert.strictEqual(log.args.push[5][0], ']')
                  })

                  suite('string event:', () => {
                    setup(() => {
                      return log.args.on[3][1]('bar')
                    })

                    test('stream.push was called twice', () => {
                      assert.strictEqual(log.counts.push, 8)
                    })

                    test('stream.push was called correctly', () => {
                      assert.strictEqual(log.args.push[6][0], ',')
                      assert.strictEqual(log.args.push[7][0], '"bar"')
                    })

                    suite('string event:', () => {
                      setup(() => {
                        return log.args.on[3][1]('baz')
                      })

                      test('stream.push was called twice', () => {
                        assert.strictEqual(log.counts.push, 10)
                      })

                      test('stream.push was called correctly', () => {
                        assert.strictEqual(log.args.push[8][0], ',')
                        assert.strictEqual(log.args.push[9][0], '"baz"')
                      })
                    })

                    suite('endArray event:', () => {
                      setup(() => {
                        return log.args.on[6][1]()
                      })

                      test('stream.push was called once', () => {
                        assert.strictEqual(log.counts.push, 9)
                      })

                      test('stream.push was called correctly', () => {
                        assert.strictEqual(log.args.push[8][0], ']')
                      })

                      suite('string event:', () => {
                        setup(() => {
                          return log.args.on[3][1]('baz')
                        })

                        test('stream.push was called twice', () => {
                          assert.strictEqual(log.counts.push, 11)
                        })

                        test('stream.push was called correctly', () => {
                          assert.strictEqual(log.args.push[9][0], ',')
                          assert.strictEqual(log.args.push[10][0], '"baz"')
                        })

                        test('stream.emit was not called', () => {
                          assert.strictEqual(log.counts.emit, 0)
                        })
                      })
                    })
                  })
                })
              })
            })

            suite('object event:', () => {
              setup(() => {
                return log.args.on[1][1]()
              })

              test('stream.push was called twice', () => {
                assert.strictEqual(log.counts.push, 4)
              })

              test('stream.push was called correctly', () => {
                assert.strictEqual(log.args.push[2][0], ',')
                assert.strictEqual(log.args.push[3][0], '{')
              })

              suite('property event:', () => {
                setup(() => {
                  return log.args.on[2][1]('bar')
                })

                test('stream.push was called once', () => {
                  assert.strictEqual(log.counts.push, 5)
                })

                test('stream.push was called correctly', () => {
                  assert.strictEqual(log.args.push[4][0], '"bar":')
                })

                suite('string event:', () => {
                  setup(() => {
                    return log.args.on[3][1]('baz')
                  })

                  test('stream.push was called once', () => {
                    assert.strictEqual(log.counts.push, 6)
                  })

                  test('stream.push was called correctly', () => {
                    assert.strictEqual(log.args.push[5][0], '"baz"')
                  })

                  suite('property event:', () => {
                    setup(() => {
                      return log.args.on[2][1]('nested')
                    })

                    test('stream.push was called twice', () => {
                      assert.strictEqual(log.counts.push, 8)
                    })

                    test('stream.push was called correctly', () => {
                      assert.strictEqual(log.args.push[6][0], ',')
                      assert.strictEqual(log.args.push[7][0], '"nested":')
                    })

                    suite('object event:', () => {
                      setup(() => {
                        return log.args.on[1][1]()
                      })

                      test('stream.push was called once', () => {
                        assert.strictEqual(log.counts.push, 9)
                      })

                      test('stream.push was called correctly', () => {
                        assert.strictEqual(log.args.push[8][0], '{')
                      })

                      suite('endObject event:', () => {
                        setup(() => {
                          return log.args.on[7][1]()
                        })

                        test('stream.push was called once', () => {
                          assert.strictEqual(log.counts.push, 10)
                        })

                        test('stream.push was called correctly', () => {
                          assert.strictEqual(log.args.push[9][0], '}')
                        })

                        suite('property event:', () => {
                          setup(() => {
                            return log.args.on[2][1]('qux')
                          })

                          test('stream.push was called twice', () => {
                            assert.strictEqual(log.counts.push, 12)
                          })

                          test('stream.push was called correctly', () => {
                            assert.strictEqual(log.args.push[10][0], ',')
                            assert.strictEqual(log.args.push[11][0], '"qux":')
                          })

                          suite('string event:', () => {
                            setup(() => {
                              return log.args.on[3][1]('wibble')
                            })

                            test('stream.push was called once', () => {
                              assert.strictEqual(log.counts.push, 13)
                            })

                            test('stream.push was called correctly', () => {
                              assert.strictEqual(log.args.push[12][0], '"wibble"')
                            })
                          })
                        })

                        suite('endObject event:', () => {
                          setup(() => {
                            return log.args.on[7][1]()
                          })

                          test('stream.push was called once', () => {
                            assert.strictEqual(log.counts.push, 11)
                          })

                          test('stream.push was called correctly', () => {
                            assert.strictEqual(log.args.push[10][0], '}')
                          })

                          suite('string event:', () => {
                            setup(() => {
                              return log.args.on[3][1]('wibble')
                            })

                            test('stream.push was called twice', () => {
                              assert.strictEqual(log.counts.push, 13)
                            })

                            test('stream.push was called correctly', () => {
                              assert.strictEqual(log.args.push[11][0], ',')
                              assert.strictEqual(log.args.push[12][0], '"wibble"')
                            })

                            test('stream.emit was not called', () => {
                              assert.strictEqual(log.counts.emit, 0)
                            })
                          })
                        })
                      })
                    })
                  })
                })
              })
            })
          })

          suite('string event, push returns false:', () => {
            setup(() => {
              results.push[0] = false
              return log.args.on[3][1]('foo')
            })

            teardown(() => {
              results.push[0] = true
            })

            test('stream.push was called once', () => {
              assert.strictEqual(log.counts.push, 1)
            })

            test('stream.push was called correctly', () => {
              assert.strictEqual(log.args.push[0][0], '[')
            })

            suite('string event:', () => {
              setup(() => {
                return log.args.on[3][1]('bar')
              })

              test('stream.push was not called', () => {
                assert.strictEqual(log.counts.push, 1)
              })

              suite('read stream, endArrayEvent:', () => {
                setup(() => {
                  log.args.JsonStream[0][0]()
                  return log.args.on[6][1]()
                })

                test('stream.push was called once', () => {
                  assert.strictEqual(log.counts.push, 2)
                })

                test('stream.push was called correctly', () => {
                  assert.strictEqual(log.args.push[1][0], '"foo"')
                })

                suite('read stream:', () => {
                  setup(() => {
                    log.args.JsonStream[0][0]()
                  })

                  test('stream.push was not called', () => {
                    assert.strictEqual(log.counts.push, 2)
                  })

                  test('stream.emit was not called', () => {
                    assert.strictEqual(log.counts.emit, 0)
                  })
                })
              })

              suite('end event:', () => {
                setup(() => {
                  return log.args.on[8][1]()
                })

                test('stream.push was not called', () => {
                  assert.strictEqual(log.counts.push, 1)
                })

                suite('read stream:', () => {
                  setup(() => {
                    log.args.JsonStream[0][0]()
                  })

                  test('stream.push was called once', () => {
                    assert.strictEqual(log.counts.push, 2)
                  })

                  test('stream.push was called correctly', () => {
                    assert.strictEqual(log.args.push[1][0], '"foo"')
                  })

                  suite('read stream:', () => {
                    setup(() => {
                      log.args.JsonStream[0][0]()
                    })

                    test('stream.push was called once', () => {
                      assert.strictEqual(log.counts.push, 3)
                    })

                    test('stream.push was called correctly', () => {
                      assert.strictEqual(log.args.push[2][0], ',')
                    })

                    suite('read stream:', () => {
                      setup(() => {
                        log.args.JsonStream[0][0]()
                      })

                      test('stream.push was called once', () => {
                        assert.strictEqual(log.counts.push, 4)
                      })

                      test('stream.push was called correctly', () => {
                        assert.strictEqual(log.args.push[3][0], '"bar"')
                      })

                      suite('read stream:', () => {
                        setup(() => {
                          log.args.JsonStream[0][0]()
                        })

                        test('stream.push was called once', () => {
                          assert.strictEqual(log.counts.push, 5)
                        })

                        test('stream.push was called correctly', () => {
                          assert.isNull(log.args.push[4][0])
                        })
                      })
                    })
                  })
                })

                suite('read stream, push returns true:', () => {
                  setup(() => {
                    results.push[0] = true
                    log.args.JsonStream[0][0]()
                  })

                  test('stream.push was called four times', () => {
                    assert.strictEqual(log.counts.push, 5)
                  })

                  test('stream.push was called correctly', () => {
                    assert.strictEqual(log.args.push[1][0], '"foo"')
                    assert.strictEqual(log.args.push[2][0], ',')
                    assert.strictEqual(log.args.push[3][0], '"bar"')
                    assert.isNull(log.args.push[4][0])
                  })

                  suite('read stream:', () => {
                    setup(() => {
                      log.args.JsonStream[0][0]()
                    })

                    test('stream.push was not called', () => {
                      assert.strictEqual(log.counts.push, 5)
                    })

                    test('stream.emit was not called', () => {
                      assert.strictEqual(log.counts.emit, 0)
                    })
                  })
                })
              })
            })
          })
        })

        suite('object event:', () => {
          setup(() => {
            log.args.JsonStream[0][0]()
            return log.args.on[1][1]()
          })

          test('stream.push was called twice', () => {
            assert.strictEqual(log.counts.push, 2)
          })

          test('stream.push was called correctly', () => {
            assert.strictEqual(log.args.push[0][0], '[')
            assert.strictEqual(log.args.push[1][0], '{')
          })

          test('stream.emit was not called', () => {
            assert.strictEqual(log.counts.emit, 0)
          })
        })
      })
    })

    suite('streamify with space option:', () => {
      let data, options, result

      setup(() => {
        data = {}
        options = { space: 2 }
        result = streamify(data, options)
      })

      test('JsonStream was called once', () => {
        assert.strictEqual(log.counts.JsonStream, 1)
      })

      test('eventify was called once', () => {
        assert.strictEqual(log.counts.eventify, 1)
      })

      test('EventEmitter.on was called eleven times', () => {
        assert.strictEqual(log.counts.on, 11)
      })

      test('stream.push was not called', () => {
        assert.strictEqual(log.counts.push, 0)
      })

      suite('read stream, object event:', () => {
        setup(() => {
          log.args.JsonStream[0][0]()
          return log.args.on[1][1]()
        })

        test('stream.push was called once', () => {
          assert.strictEqual(log.counts.push, 1)
        })

        test('stream.push was called correctly', () => {
          assert.strictEqual(log.args.push[0][0], '{')
        })

        suite('property event:', () => {
          setup(() => {
            return log.args.on[2][1]('foo')
          })

          test('stream.push was called twice', () => {
            assert.strictEqual(log.counts.push, 3)
          })

          test('stream.push was called correctly', () => {
            assert.strictEqual(log.args.push[1][0], '\n  ')
            assert.strictEqual(log.args.push[2][0], '"foo":')
          })

          suite('string event:', () => {
            setup(() => {
              return log.args.on[3][1]('bar')
            })

            test('stream.push was called twice', () => {
              assert.strictEqual(log.counts.push, 5)
            })

            test('stream.push was called correctly', () => {
              assert.strictEqual(log.args.push[3][0], ' ')
              assert.strictEqual(log.args.push[4][0], '"bar"')
            })

            suite('property event:', () => {
              setup(() => {
                return log.args.on[2][1]('baz')
              })

              test('stream.push was called three times', () => {
                assert.strictEqual(log.counts.push, 8)
              })

              test('stream.push was called correctly', () => {
                assert.strictEqual(log.args.push[5][0], ',')
                assert.strictEqual(log.args.push[6][0], '\n  ')
                assert.strictEqual(log.args.push[7][0], '"baz":')
              })

              suite('string event:', () => {
                setup(() => {
                  return log.args.on[3][1]('qux')
                })

                test('stream.push was called twice', () => {
                  assert.strictEqual(log.counts.push, 10)
                })

                test('stream.push was called correctly', () => {
                  assert.strictEqual(log.args.push[8][0], ' ')
                  assert.strictEqual(log.args.push[9][0], '"qux"')
                })

                suite('property event:', () => {
                  setup(() => {
                    return log.args.on[2][1]('wibble')
                  })

                  test('stream.push was called three times', () => {
                    assert.strictEqual(log.counts.push, 13)
                  })

                  test('stream.push was called correctly', () => {
                    assert.strictEqual(log.args.push[10][0], ',')
                    assert.strictEqual(log.args.push[11][0], '\n  ')
                    assert.strictEqual(log.args.push[12][0], '"wibble":')
                  })

                  suite('array event:', () => {
                    setup(() => {
                      return log.args.on[0][1]()
                    })

                    test('stream.push was called twice', () => {
                      assert.strictEqual(log.counts.push, 15)
                    })

                    test('stream.push was called correctly', () => {
                      assert.strictEqual(log.args.push[13][0], ' ')
                      assert.strictEqual(log.args.push[14][0], '[')
                    })

                    suite('string event:', () => {
                      setup(() => {
                        return log.args.on[3][1]('0')
                      })

                      test('stream.push was called twice', () => {
                        assert.strictEqual(log.counts.push, 17)
                      })

                      test('stream.push was called correctly', () => {
                        assert.strictEqual(log.args.push[15][0], '\n    ')
                        assert.strictEqual(log.args.push[16][0], '"0"')
                      })

                      suite('string event:', () => {
                        setup(() => {
                          return log.args.on[3][1]('1')
                        })

                        test('stream.push was called three times', () => {
                          assert.strictEqual(log.counts.push, 20)
                        })

                        test('stream.push was called correctly', () => {
                          assert.strictEqual(log.args.push[17][0], ',')
                          assert.strictEqual(log.args.push[18][0], '\n    ')
                          assert.strictEqual(log.args.push[19][0], '"1"')
                        })

                        suite('endArray event:', () => {
                          setup(() => {
                            return log.args.on[6][1]()
                          })

                          test('stream.push was called twice', () => {
                            assert.strictEqual(log.counts.push, 22)
                          })

                          test('stream.push was called correctly', () => {
                            assert.strictEqual(log.args.push[20][0], '\n  ')
                            assert.strictEqual(log.args.push[21][0], ']')
                          })

                          suite('property event:', () => {
                            setup(() => {
                              return log.args.on[2][1]('a')
                            })

                            test('stream.push was called three times', () => {
                              assert.strictEqual(log.counts.push, 25)
                            })

                            test('stream.push was called correctly', () => {
                              assert.strictEqual(log.args.push[22][0], ',')
                              assert.strictEqual(log.args.push[23][0], '\n  ')
                              assert.strictEqual(log.args.push[24][0], '"a":')
                            })

                            suite('string event:', () => {
                              setup(() => {
                                return log.args.on[3][1]('b')
                              })

                              test('stream.push was called twice', () => {
                                assert.strictEqual(log.counts.push, 27)
                              })

                              test('stream.push was called correctly', () => {
                                assert.strictEqual(log.args.push[25][0], ' ')
                                assert.strictEqual(log.args.push[26][0], '"b"')
                              })

                              suite('endObject event:', () => {
                                setup(() => {
                                  return log.args.on[7][1]()
                                })

                                test('stream.push was called twice', () => {
                                  assert.strictEqual(log.counts.push, 29)
                                })

                                test('stream.push was called correctly', () => {
                                  assert.strictEqual(log.args.push[27][0], '\n')
                                  assert.strictEqual(log.args.push[28][0], '}')
                                })

                                test('stream.emit was not called', () => {
                                  assert.strictEqual(log.counts.emit, 0)
                                })
                              })
                            })
                          })
                        })
                      })
                    })
                  })
                })
              })
            })
          })
        })
      })

      suite('read stream, end event:', () => {
        setup(() => {
          log.args.JsonStream[0][0]()
          return log.args.on[8][1]()
        })

        test('stream.push was called once', () => {
          assert.strictEqual(log.counts.push, 1)
        })

        test('stream.push was called correctly', () => {
          assert.isNull(log.args.push[0][0])
        })

        test('stream.emit was not called', () => {
          assert.strictEqual(log.counts.emit, 0)
        })
      })

      suite('error event:', () => {
        setup(() => {
          return log.args.on[9][1]('foo')
        })

        test('stream.emit was called once', () => {
          assert.strictEqual(log.counts.emit, 1)
        })

        test('stream.emit was called correctly', () => {
          assert.lengthOf(log.args.emit[0], 2)
          assert.strictEqual(log.args.emit[0][0], 'error')
          assert.strictEqual(log.args.emit[0][1], 'foo')
        })
      })

      suite('dataError event:', () => {
        setup(() => {
          return log.args.on[10][1]('bar')
        })

        test('stream.emit was called once', () => {
          assert.strictEqual(log.counts.emit, 1)
        })

        test('stream.emit was called correctly', () => {
          assert.lengthOf(log.args.emit[0], 2)
          assert.strictEqual(log.args.emit[0][0], 'dataError')
          assert.strictEqual(log.args.emit[0][1], 'bar')
        })
      })
    })
  })
})
