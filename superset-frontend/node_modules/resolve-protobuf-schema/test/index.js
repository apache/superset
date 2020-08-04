var tape = require('tape')
var schema = require('../')

var test = function(name, fn) {
  tape(name, function(t) {
    fn(t, schema)
  })
  tape(name+' sync', function(t) {
    fn(t, function(name, cb) {
      cb(null, schema.sync(name))
    })
  })
}

test('c', function(t, schema) {
  schema(__dirname+'/c.proto', function(err, sch) {
    t.notOk(err, 'no err')
    t.same(sch.messages.length, 1)
    schema(__dirname+'/c', function(err, sch) {
      t.notOk(err, 'no err')
      t.same(sch.messages.length, 1)
      t.end()
    })
  })
})

test('b imports c', function(t, schema) {
  schema(__dirname+'/b.proto', function(err, sch) {
    t.notOk(err, 'no err')
    t.same(sch.messages.length, 2)
    schema(__dirname+'/b', function(err, sch) {
      t.notOk(err, 'no err')
      t.same(sch.messages.length, 2)
      t.end()
    })
  })
})

test('a imports b imports c', function(t, schema) {
  schema(__dirname+'/a.proto', function(err, sch) {
    t.notOk(err, 'no err')
    t.same(sch.messages.length, 3)
    schema(__dirname+'/a', function(err, sch) {
      t.notOk(err, 'no err')
      t.same(sch.messages.length, 3)
      t.end()
    })
  })
})