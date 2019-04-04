## Tests

To execute the tests, install `mocha ` and run the following in the root of
the project:

    npm install -g mocha
    mocha test --recursive

It's important to run mocha with the `--recursive` flag, as most tests are
located in nested folders.


## Code coverage

To test code coverage of the tests, install `istanbul` and run it:

    npm install -g istanbul
    istanbul cover _mocha -- test --recursive

Note the underscore before mocha, and the `--` surrounded by spaces after _mocha.
See also https://github.com/gotwarlost/istanbul/issues/44.

To see the results, open the generated report in your browser:

    ./coverage/lcov-report/index.html
