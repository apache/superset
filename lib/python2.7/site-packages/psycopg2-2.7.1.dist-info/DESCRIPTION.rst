Psycopg is the most popular PostgreSQL database adapter for the Python
programming language.  Its main features are the complete implementation of
the Python DB API 2.0 specification and the thread safety (several threads can
share the same connection).  It was designed for heavily multi-threaded
applications that create and destroy lots of cursors and make a large number
of concurrent "INSERT"s or "UPDATE"s.

Psycopg 2 is mostly implemented in C as a libpq wrapper, resulting in being
both efficient and secure.  It features client-side and server-side cursors,
asynchronous communication and notifications, "COPY TO/COPY FROM" support.
Many Python types are supported out-of-the-box and adapted to matching
PostgreSQL data types; adaptation can be extended and customized thanks to a
flexible objects adaptation system.

Psycopg 2 is both Unicode and Python 3 friendly.


Documentation
-------------

Documentation is included in the 'doc' directory and is `available online`__.

.. __: http://initd.org/psycopg/docs/


Installation
------------

If your ``pip`` version supports wheel_ packages it should be possible to
install a binary version of Psycopg including all the dependencies. Just run::

    pip install psycopg2

If you want to build Psycopg from source you will need some prerequisite (a C
compiler, Python and libpq development packages). If you have what you need
the standard::

    python setup.py build
    sudo python setup.py install

should work no problem.  In case you have any problem check the 'install' and
the 'faq' documents in the docs or online__.

.. _wheel: http://pythonwheels.com/
.. __: http://initd.org/psycopg/docs/install.html#install-from-source

For any other resource (source code repository, bug tracker, mailing list)
please check the `project homepage`__.

.. __: http://initd.org/psycopg/


:Linux/OSX: |travis|
:Windows: |appveyor|

.. |travis| image:: https://travis-ci.org/psycopg/psycopg2.svg?branch=master
    :target: https://travis-ci.org/psycopg/psycopg2
    :alt: Linux and OSX build status

.. |appveyor| image:: https://ci.appveyor.com/api/projects/status/github/psycopg/psycopg2?branch=master&svg=true
    :target: https://ci.appveyor.com/project/psycopg/psycopg2
    :alt: Windows build status


