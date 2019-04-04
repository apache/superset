Build steps:

- Build `nvd3`.
- Build the example.
- Start an HTTP server.

    nvd3 $ grunt production
    nvd3 $ cd test/node
    nvd3/test/node $ npm install .
    nvd3/test/node $ grunt
    nvd3/test/node $ python -m SimpleHTTPServer 8000

Browse to `http://localhost:8000/nodeTest.html`
