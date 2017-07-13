nose extends the test loading and running features of unittest, making
it easier to write, find and run tests.

By default, nose will run tests in files or directories under the current
working directory whose names include "test" or "Test" at a word boundary
(like "test_this" or "functional_test" or "TestClass" but not
"libtest"). Test output is similar to that of unittest, but also includes
captured stdout output from failing tests, for easy print-style debugging.

These features, and many more, are customizable through the use of
plugins. Plugins included with nose provide support for doctest, code
coverage and profiling, flexible attribute-based test selection,
output capture and more. More information about writing plugins may be
found on in the nose API documentation, here:
http://readthedocs.org/docs/nose/

If you have recently reported a bug marked as fixed, or have a craving for
the very latest, you may want the development version instead:
https://github.com/nose-devs/nose/tarball/master#egg=nose-dev


