Flask-CORS
==========

|Build Status| |Latest Version| |Supported Python versions|
|License|

A Flask extension for handling Cross Origin Resource Sharing (CORS),
making cross-origin AJAX possible.

This package has a simple philosophy, when you want to enable CORS, you
wish to enable it for all use cases on a domain. This means no mucking
around with different allowed headers, methods, etc. By default,
submission of cookies across domains is disabled due to the security
implications, please see the documentation for how to enable
credential'ed requests, and please make sure you add some sort of
`CRSF <http://en.wikipedia.org/wiki/Cross-site_request_forgery>`__
protection before doing so!

Installation
------------

Install the extension with using pip, or easy\_install.

.. code:: bash

    $ pip install -U flask-cors

Usage
-----

This package exposes a Flask extension which by default enables CORS support on all routes, for all origins and methods. It allows parameterization of all CORS headers on a per-resource level. The package also contains a decorator, for those who prefer this approach.

Simple Usage
~~~~~~~~~~~~

In the simplest case, initialize the Flask-Cors extension with default
arguments in order to allow CORS for all domains on all routes. See the
full list of options in the `documentation <http://flask-cors.corydolphin.com/en/latest/api.html#extension>`__.

.. code:: python


    from flask import Flask
    from flask_cors import CORS, cross_origin

    app = Flask(__name__)
    CORS(app)

    @app.route("/")
    def helloWorld():
      return "Hello, cross-origin-world!"

Resource specific CORS
^^^^^^^^^^^^^^^^^^^^^^

Alternatively, you can specify CORS options on a resource and origin
level of granularity by passing a dictionary as the `resources` option,
mapping paths to a set of options. See the
full list of options in the `documentation <http://flask-cors.corydolphin.com/en/latest/api.html#extension>`__.

.. code:: python

    app = Flask(__name__)
    cors = CORS(app, resources={r"/api/*": {"origins": "*"}})

    @app.route("/api/v1/users")
    def list_users():
      return "user example"

Route specific CORS via decorator
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

This extension also exposes a simple decorator to decorate flask routes
with. Simply add ``@cross_origin()`` below a call to Flask's
``@app.route(..)`` to allow CORS on a given route. See the
full list of options in the `decorator documentation <http://flask-cors.corydolphin.com/en/latest/api.html#decorator>`__.

.. code:: python

    @app.route("/")
    @cross_origin()
    def helloWorld():
      return "Hello, cross-origin-world!"

Documentation
-------------

For a full list of options, please see the full
`documentation <http://flask-cors.corydolphin.com/en/latest/>`__

Troubleshooting
---------------

If things aren't working as you expect, enable logging to help understand
what is going on under the hood, and why.

.. code:: python

    logging.getLogger('flask_cors').level = logging.DEBUG


Tests
-----

A simple set of tests is included in ``test/``. To run, install nose,
and simply invoke ``nosetests`` or ``python setup.py test`` to exercise
the tests.

Contributing
------------

Questions, comments or improvements? Please create an issue on
`Github <https://github.com/corydolphin/flask-cors>`__, tweet at
`@corydolphin <https://twitter.com/corydolphin>`__ or send me an email.
I do my best to include every contribution proposed in any way that I
can.

Credits
-------

This Flask extension is based upon the `Decorator for the HTTP Access
Control <http://flask.pocoo.org/snippets/56/>`__ written by Armin
Ronacher.

.. |Build Status| image:: https://api.travis-ci.org/corydolphin/flask-cors.svg?branch=master
   :target: https://travis-ci.org/corydolphin/flask-cors
.. |Latest Version| image:: https://img.shields.io/pypi/v/Flask-Cors.svg
   :target: https://pypi.python.org/pypi/Flask-Cors/
.. |Supported Python versions| image:: https://img.shields.io/pypi/pyversions/Flask-Cors.svg
   :target: https://img.shields.io/pypi/pyversions/Flask-Cors.svg
.. |License| image:: http://img.shields.io/:license-mit-blue.svg
   :target: https://pypi.python.org/pypi/Flask-Cors/


