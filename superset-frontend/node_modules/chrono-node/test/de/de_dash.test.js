var chrono = require('../../src/chrono');
test("Test - Should handle de dayname dd-mm-yy", function() {
  var text = "Freitag 30.12.16";
  var results = chrono.strict.parse(text, new Date(2012,7,10));
  expect(results.length).toBe(1)
});
