module.exports = typeof function foo() {}.name === 'string'; // when function names are minified, checking for "foo" would break
