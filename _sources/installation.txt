Installation & Configuration
============================

Getting Started
---------------

Caravel is currently only tested using Python 2.7.*. Python 3 support is
on the roadmap, Python 2.6 won't be supported.


OS dependencies
---------------

Caravel stores database connection information in its metadata database.
For that purpose, we use the ``cryptography`` Python library to encrypt
connection passwords. Unfortunately this library has OS level dependencies.

You may want to attempt the next step
("Caravel installation and initialization") and come back to this step if
you encounter an error.

Here's how to install them:

For **Debian** and **Ubuntu**, the following command will ensure that
the required dependencies are installed: ::

    sudo apt-get install build-essential libssl-dev libffi-dev python-dev

For **Fedora** and **RHEL-derivatives**, the following command will ensure
that the required dependencies are installed: ::

    sudo yum install gcc libffi-devel python-devel openssl-devel

**OSX** ::

    brew install pkg-config libffi openssl
    env LDFLAGS="-L$(brew --prefix openssl)/lib" CFLAGS="-I$(brew --prefix openssl)/include" pip install cryptography

**Windows** isn't officially supported at this point, but if you want to
attempt it: ::

    C:\> \path\to\vcvarsall.bat x86_amd64
    C:\> set LIB=C:\OpenSSL-1.0.1f-64bit\lib;%LIB%
    C:\> set INCLUDE=C:\OpenSSL-1.0.1f-64bit\include;%INCLUDE%
    C:\> pip install cryptography

    # You may also have to create C:\Temp
    C:\> md C:\Temp


Caravel installation and initialization
---------------------------------------
Follow these few simple steps to install Caravel.::

    # Install caravel
    pip install caravel

    # Create an admin user
    fabmanager create-admin --app caravel

    # Initialize the database
    caravel db upgrade

    # Create default roles and permissions
    caravel init

    # Load some data to play with
    caravel load_examples

    # Start the development web server
    caravel runserver -d


After installation, you should be able to point your browser to the right
hostname:port [http://localhost:8088](http://localhost:8088), login using
the credential you entered while creating the admin account, and navigate to
`Menu -> Admin -> Refresh Metadata`. This action should bring in all of
your datasources for Caravel to be aware of, and they should show up in
`Menu -> Datasources`, from where you can start playing with your data!


Configuration
-------------

To configure your application, you need to create a file (module)
``caravel_config.py`` and make sure it is in your PYTHONPATH. Here are some
of the parameters you can copy / paste in that configuration module: ::

    #---------------------------------------------------------
    # Caravel specifix config
    #---------------------------------------------------------
    ROW_LIMIT = 5000
    WEBSERVER_THREADS = 8

    CARAVEL_WEBSERVER_PORT = 8088
    #---------------------------------------------------------

    #---------------------------------------------------------
    # Flask App Builder configuration
    #---------------------------------------------------------
    # Your App secret key
    SECRET_KEY = '\2\1thisismyscretkey\1\2\e\y\y\h'

    # The SQLAlchemy connection string to your database backend
    # This connection defines the path to the database that stores your
    # caravel metadata (slices, connections, tables, dashboards, ...).
    # Note that the connection information to connect to the datasources
    # you want to explore are managed directly in the web UI
    SQLALCHEMY_DATABASE_URI = 'sqlite:////tmp/caravel.db'

    # Flask-WTF flag for CSRF
    CSRF_ENABLED = True

    # Whether to run the web server in debug mode or not
    DEBUG = True

This file also allows you to define configuration parameters used by
Flask App Builder, the web framework used by Caravel. Please consult
the `Flask App Builder Documentation
<http://flask-appbuilder.readthedocs.org/en/latest/config.html>`_
for more information on how to configure Caravel.


Caching
-------

Caravel uses `Flask-Cache <https://pythonhosted.org/Flask-Cache/>`_ for
caching purpose. Configuring your caching backend is as easy as providing
a ``CACHE_CONFIG``, constant in your ``caravel_config.py`` that
complies with the Flask-Cache specifications.

Flask-Cache supports multiple caching backends (Redis, Memcache,
SimpleCache (in-memory), or the local filesystem).

For setting your timeouts, this is done in the Caravel metadata and goes
up the "timeout searchpath", from your slice configuration, to your
data source's configuration, to your database's and ultimately falls back
into your global default defined in ``CACHE_CONFIG``.


Deeper SQLAlchemy integration
-----------------------------

It is possible to tweak the database connection information using the
parameters exposed by SQLAlchemy. In the ``Database`` edit view, you will
find an ``extra`` field as a ``JSON`` blob.

.. image:: _static/img/tutorial/add_db.png

This JSON string contains extra configuration elements. The ``engine_params``
object gets unpacked into the
`sqlalchemy.create_engine <http://docs.sqlalchemy.org/en/latest/core/engines.html#sqlalchemy.create_engine>`_ call,
while the ``metadata_params`` get unpacked into the
`sqlalchemy.MetaData <http://docs.sqlalchemy.org/en/rel_1_0/core/metadata.html#sqlalchemy.schema.MetaData>`_ call. Refer to the SQLAlchemy docs for more information.


Postgres & Redshift
-------------------

Postgres and Redshift use the concept of **schema** as a logical entity
on top of the **database**. For Caravel to connect to a specific schema,
you can either specify it in the ``metadata_params`` key of the ``extra``
JSON blob described above, or you can use a database user name to connect to
the database that matches the schema name you are interested it.


Druid
-----

* From the UI, enter the information about your clusters in the
  ``Admin->Clusters`` menu by hitting the + sign.

* Once the Druid cluster connection information is entered, hit the
  ``Admin->Refresh Metadata`` menu item to populate

* Navigate to your datasources
