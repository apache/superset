const rules = require('./index').rules;
const RuleTester = require('eslint').RuleTester;
const ruleTester = new RuleTester();

ruleTester.run('no-only-tests', rules['no-only-tests'], {
  valid: [
    'describe("Some describe block", function() {});',
    'it("Some assertion", function() {});',
    'xit.only("Some assertion", function() {});',
    'xdescribe.only("Some describe block", function() {});',
    'xcontext.only("A context block", function() {});',
    'xtape.only("A tape block", function() {});',
    'xtest.only("A test block", function() {});',
    'other.only("An other block", function() {});',
    'var args = {only: "test"};',
    'it("should pass meta only through", function() {});'
  ],

  invalid: [{
    code: 'describe.only("Some describe block", function() {});',
    errors: [{message: 'describe.only not permitted'}]
  }, {
    code: 'it.only("Some assertion", function() {});',
    errors: [{message: 'it.only not permitted'}]
  }, {
    code: 'context.only("Some context", function() {});',
    errors: [{message: 'context.only not permitted'}]
  }, {
    code: 'test.only("Some test", function() {});',
    errors: [{message: 'test.only not permitted'}]
  }, {
    code: 'tape.only("A tape", function() {});',
    errors: [{message: 'tape.only not permitted'}]
  }, {
    code: 'fixture.only("A fixture", function() {});',
    errors: [{message: 'fixture.only not permitted'}]
  }]
});

console.log('Tests completed successfully');
