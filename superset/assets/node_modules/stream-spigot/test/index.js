var test = require("tap").test
var concat = require("concat-stream")

var spigot

test("load", function (t) {
  t.plan(1)

  spigot = require("../")
  t.ok(spigot, "loaded module")
})

test("simple", function (t) {
  t.plan(1)

  var content = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"

  function match(d) {
    t.equals(d.toString(), content)
  }

  var s = spigot([content]).pipe(concat(match))
})

test("chunked", function (t) {
  t.plan(1)

  var content = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"

  function match(d) {
    t.equals(d.toString(), content)
  }

  var s = spigot(["ABCDEFG","HIJKLMNOPQ","RSTUVWXYZ"]).pipe(concat(match))
})

test("null in array", function (t) {
  t.plan(1)

  var content = "AB"

  function match(d) {
    t.equals(d.toString(), content)
  }

  var s = spigot(["A", "B", null, "C"]).pipe(concat(match))
})

test("objectMode", function (t) {
  t.plan(1)

  var input = {cats: "meow", dogs: "woof"}

  function match(d) {
    t.equals(d[0], input)
  }

  var s = spigot({objectMode: true}, [input]).pipe(concat(match))
})

test("function", function (t) {
  t.plan(1)

  var c = 0
  var fn = function () {
    if (c++ < 5) {
      return c.toString()
    }
  }

  function match(d) {
    t.equals(d.toString(), "12345")
  }

  var s = spigot(fn).pipe(concat(match))
})

test("async function", function (t) {
  t.plan(1)

  var c = 0
  var fn = function (cb) {
    if (c++ < 5) {
      setTimeout(function () {
        return cb(null, c.toString())
      }, 100)
    }
    else {
      setTimeout(function () {
        return cb(null, null)
      }, 100)
    }
  }

  function match(d) {
    t.equals(d.toString(), "12345")
  }

  var s = spigot(fn).pipe(concat(match))
})

test("function objectMode", function (t) {
  t.plan(1)

  var c = 0
  var fn = function () {
    if (c++ < 5) {
      return {val: c}
    }
  }

  function match(d) {
    t.equivalent(d, [{val: 1}, {val: 2}, {val: 3}, {val: 4}, {val: 5}])
  }

  var s = spigot({objectMode: true}, fn).pipe(concat(match))
})
