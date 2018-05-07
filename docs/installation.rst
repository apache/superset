Installation & Configuration
============================

Getting Started
---------------

Superset is tested against Python ``2.7`` and Python ``3.4``.
Airbnb currently uses 2.7.* in production. We do not plan on supporting
Python ``2.6``.

Cloud-native!
-------------

Superset is designed to be highly available. It is
"cloud-native" as it has been designed scale out in large,
distributed environments, and works well inside containers.
While you can easily
test drive Superset on a modest setup or simply on your laptop,
there's virtually no limit around scaling out the platform.
Superset is also cloud-native in the sense that it is
flexible and lets you choose your web server (Gunicorn, Nginx, Apache),
your metadata database engine (MySQL, Postgres, MariaDB, ...),
your message queue (Redis, RabbitMQ, SQS, ...),
your results backend (S3, Redis, Memcached, ...), your caching layer
(memcached, Redis, ...), works well with services like NewRelic, StatsD and
DataDog, and has the ability to run analytic workloads against
most popular database technologies.

Superset is battle tested in large environments with hundreds
of concurrent users. Airbnb's production environment runs inside
Kubernetes and serves 600+ daily active users viewing over 100K charts a
day.

The Superset web server and the Superset Celery workers (optional)
are stateless, so you can scale out by running on as many servers
as needed.

OS dependencies
---------------

Superset stores database connection information in its metadata database.
For that purpose, we use the ``cryptography`` Python library to encrypt
connection passwords. Unfortunately this library has OS level dependencies.

You may want to attempt the next step
("Superset installation and initialization") and come back to this step if
you encounter an error.

Here's how to install them:

For **Debian** and **Ubuntu**, the following command will ensure that
the required dependencies are installed: ::

    sudo apt-get install build-essential libssl-dev libffi-dev python-dev python-pip libsasl2-dev libldap2-dev

**Ubuntu 16.04** If you have python3.5 installed alongside with python2.7, as is default on **Ubuntu 16.04 LTS**, run this command also

    sudo apt-get install build-essential libssl-dev libffi-dev python3.5-dev python-pip libsasl2-dev libldap2-dev

otherwhise build for ``cryptography`` fails.

For **Fedora** and **RHEL-derivatives**, the following command will ensure
that the required dependencies are installed: ::

    sudo yum upgrade python-setuptools
    sudo yum install gcc gcc-c++ libffi-devel python-devel python-pip python-wheel openssl-devel libsasl2-devel openldap-devel

**OSX**, system python is not recommended. brew's python also ships with pip  ::

    brew install pkg-config libffi openssl python
    env LDFLAGS="-L$(brew --prefix openssl)/lib" CFLAGS="-I$(brew --prefix openssl)/include" pip install cryptography==1.9

**Windows** isn't officially supported at this point, but if you want to
attempt it, download `get-pip.py <https://bootstrap.pypa.io/get-pip.py>`_, and run ``python get-pip.py`` which may need admin access. Then run the following: ::

    C:\> pip install cryptography

    # You may also have to create C:\Temp
    C:\> md C:\Temp

Python virtualenv
-----------------
It is recommended to install Superset inside a virtualenv. Python 3 already ships virtualenv, for
Python 2 you need to install it. If it's packaged for your operating systems install it from there
otherwise you can install from pip: ::

    pip install virtualenv

You can create and activate a virtualenv by: ::

    # virtualenv is shipped in Python 3 as pyvenv
    virtualenv venv
    . ./venv/bin/activate

On windows the syntax for activating it is a bit different: ::

    venv\Scripts\activate

Once you activated your virtualenv everything you are doing is confined inside the virtualenv.
To exit a virtualenv just type ``deactivate``.

Python's setup tools and pip
----------------------------
Put all the chances on your side by getting the very latest ``pip``
and ``setuptools`` libraries.::

    pip install --upgrade setuptools pip

Superset installation and initialization
----------------------------------------
Follow these few simple steps to install Superset.::

    # Install superset
    pip install superset

    # Create an admin user (you will be prompted to set username, first and last name before setting a password)
    fabmanager create-admin --app superset

    # Initialize the database
    superset db upgrade

    # Load some data to play with
    superset load_examples

    # Create default roles and permissions
    superset init

    # To start a development web server on port 8088, use -p to bind to another port
    superset runserver -d


After installation, you should be able to point your browser to the right
hostname:port `http://localhost:8088 <http://localhost:8088>`_, login using
the credential you entered while creating the admin account, and navigate to
`Menu -> Admin -> Refresh Metadata`. This action should bring in all of
your datasources for Superset to be aware of, and they should show up in
`Menu -> Datasources`, from where you can start playing with your data!

A proper WSGI HTTP Server
-------------------------

While you can setup Superset to run on Nginx or Apache, many use
Gunicorn, preferably in **async mode**, which allows for impressive
concurrency even and is fairly easy to install and configure. Please
refer to the
documentation of your preferred technology to set up this Flask WSGI
application in a way that works well in your environment. Here's an **async**
setup known to work well in production: ::

 　gunicorn \
		-w 10 \
		-k gevent \
		--timeout 120 \
		-b  0.0.0.0:6666 \
		--limit-request-line 0 \
		--limit-request-field_size 0 \
		--statsd-host localhost:8125 \
		superset:app

Refer to the
`Gunicorn documentation <http://docs.gunicorn.org/en/stable/design.html>`_
for more information.

Note that *gunicorn* does not
work on Windows so the `superset runserver` command is not expected to work
in that context. Also note that the development web
server (`superset runserver -d`) is not intended for production use.

If not using gunicorn, you may want to disable the use of flask-compress
by setting `ENABLE_FLASK_COMPRESS = False` in your `superset_config.py`

Flask-AppBuilder Permissions
----------------------------

By default every time the Flask-AppBuilder (FAB) app is initialized the
permissions and views are added automatically to the backend and associated with
the ‘Admin’ role. The issue however is when you are running multiple concurrent
workers this creates a lot of contention and race conditions when defining
permissions and views.

To alleviate this issue, the automatic updating of permissions can be disabled
by setting the :envvar:`SUPERSET_UPDATE_PERMS` environment variable to `0`.
The value `1` enables it, `0` disables it. Note if undefined the functionality
is enabled to maintain backwards compatibility.

In a production environment initialization could take on the following form:

  export SUPERSET_UPDATE_PERMS=1
  superset init

  export SUPERSET_UPDATE_PERMS=0
  gunicorn -w 10 ... superset:app

Configuration behind a load balancer
------------------------------------

If you are running superset behind a load balancer or reverse proxy (e.g. NGINX
or ELB on AWS), you may need to utilise a healthcheck endpoint so that your
load balancer knows if your superset instance is running. This is provided
at ``/health`` which will return a 200 response containing "OK" if the
webserver is running.

If the load balancer is inserting X-Forwarded-For/X-Forwarded-Proto headers, you
should set `ENABLE_PROXY_FIX = True` in the superset config file to extract and use
the headers.

In case that the reverse proxy is used for providing ssl encryption,
an explicit definition of the `X-Forwarded-Proto` may be required.
For the Apache webserver this can be set as follows: ::

    RequestHeader set X-Forwarded-Proto "https"

Configuration
-------------

To configure your application, you need to create a file (module)
``superset_config.py`` and make sure it is in your PYTHONPATH. Here are some
of the parameters you can copy / paste in that configuration module: ::

    #---------------------------------------------------------
    # Superset specific config
    #---------------------------------------------------------
    ROW_LIMIT = 5000

    SUPERSET_WEBSERVER_PORT = 8088
    #---------------------------------------------------------

    #---------------------------------------------------------
    # Flask App Builder configuration
    #---------------------------------------------------------
    # Your App secret key
    SECRET_KEY = '\2\1thisismyscretkey\1\2\e\y\y\h'

    # The SQLAlchemy connection string to your database backend
    # This connection defines the path to the database that stores your
    # superset metadata (slices, connections, tables, dashboards, ...).
    # Note that the connection information to connect to the datasources
    # you want to explore are managed directly in the web UI
    SQLALCHEMY_DATABASE_URI = 'sqlite:////path/to/superset.db'

    # Flask-WTF flag for CSRF
    WTF_CSRF_ENABLED = True
    # Add endpoints that need to be exempt from CSRF protection
    WTF_CSRF_EXEMPT_LIST = []
    # A CSRF token that expires in 1 year
    WTF_CSRF_TIME_LIMIT = 60 * 60 * 24 * 365

    # Set this API key to enable Mapbox visualizations
    MAPBOX_API_KEY = ''

All the parameters and default values defined in
https://github.com/apache/incubator-superset/blob/master/superset/config.py
can be altered in your local ``superset_config.py`` .
Administrators will want to
read through the file to understand what can be configured locally
as well as the default values in place.

Since ``superset_config.py`` acts as a Flask configuration module, it
can be used to alter the settings Flask itself,
as well as Flask extensions like ``flask-wtf``, ``flask-cache``,
``flask-migrate``, and ``flask-appbuilder``. Flask App Builder, the web
framework used by Superset offers many configuration settings. Please consult
the `Flask App Builder Documentation
<http://flask-appbuilder.readthedocs.org/en/latest/config.html>`_
for more information on how to configure it.

Make sure to change:

* *SQLALCHEMY_DATABASE_URI*, by default it is stored at *~/.superset/superset.db*
* *SECRET_KEY*, to a long random string

In case you need to exempt endpoints from CSRF, e.g. you are running a custom
auth postback endpoint, you can add them to *WTF_CSRF_EXEMPT_LIST*

     WTF_CSRF_EXEMPT_LIST = ['']

Database dependencies
---------------------

Superset does not ship bundled with connectivity to databases, except
for Sqlite, which is part of the Python standard library.
You'll need to install the required packages for the database you
want to use as your metadata database as well as the packages needed to
connect to the databases you want to access through Superset.

Here's a list of some of the recommended packages.

+---------------+-------------------------------------+-------------------------------------------------+
| database      | pypi package                        | SQLAlchemy URI prefix                           |
+===============+=====================================+=================================================+
|  MySQL        | ``pip install mysqlclient``         | ``mysql://``                                    |
+---------------+-------------------------------------+-------------------------------------------------+
|  Postgres     | ``pip install psycopg2``            | ``postgresql+psycopg2://``                      |
+---------------+-------------------------------------+-------------------------------------------------+
|  Presto       | ``pip install pyhive``              | ``presto://``                                   |
+---------------+-------------------------------------+-------------------------------------------------+
|  Oracle       | ``pip install cx_Oracle``           | ``oracle://``                                   |
+---------------+-------------------------------------+-------------------------------------------------+
|  sqlite       |                                     | ``sqlite://``                                   |
+---------------+-------------------------------------+-------------------------------------------------+
|  Snowflake    | ``pip install snowflake-sqlalchemy``| ``snowflake://``                                |
+---------------+-------------------------------------+-------------------------------------------------+
|  Redshift     | ``pip install sqlalchemy-redshift`` | ``redshift+psycopg2://``                        |
+---------------+-------------------------------------+-------------------------------------------------+
|  MSSQL        | ``pip install pymssql``             | ``mssql://``                                    |
+---------------+-------------------------------------+-------------------------------------------------+
|  Impala       | ``pip install impyla``              | ``impala://``                                   |
+---------------+-------------------------------------+-------------------------------------------------+
|  SparkSQL     | ``pip install pyhive``              | ``jdbc+hive://``                                |
+---------------+-------------------------------------+-------------------------------------------------+
|  Greenplum    | ``pip install psycopg2``            | ``postgresql+psycopg2://``                      |
+---------------+-------------------------------------+-------------------------------------------------+
|  Athena       | ``pip install "PyAthenaJDBC>1.0.9"``| ``awsathena+jdbc://``                           |
+---------------+-------------------------------------+-------------------------------------------------+
|  Vertica      | ``pip install                       |  ``vertica+vertica_python://``                  |
|               | sqlalchemy-vertica-python``         |                                                 |
+---------------+-------------------------------------+-------------------------------------------------+
|  ClickHouse   | ``pip install                       | ``clickhouse://``                               |
|               | sqlalchemy-clickhouse``             |                                                 |
+---------------+-------------------------------------+-------------------------------------------------+
|  Kylin        | ``pip install kylinpy``             | ``kylin://``                                    |
+---------------+-------------------------------------+-------------------------------------------------+
|  BigQuery     | ``pip install pybigquery``          | ``bigquery://``                                 |
+---------------+-------------------------------------+-------------------------------------------------+

Note that many other database are supported, the main criteria being the
existence of a functional SqlAlchemy dialect and Python driver. Googling
the keyword ``sqlalchemy`` in addition of a keyword that describes the
database you want to connect to should get you to the right place.

(AWS) Athena
------------

The connection string for Athena looks like this ::

    awsathena+jdbc://{aws_access_key_id}:{aws_secret_access_key}@athena.{region_name}.amazonaws.com/{schema_name}?s3_staging_dir={s3_staging_dir}&...

Where you need to escape/encode at least the s3_staging_dir, i.e., ::

    s3://... -> s3%3A//...


Caching
-------

Superset uses `Flask-Cache <https://pythonhosted.org/Flask-Cache/>`_ for
caching purpose. Configuring your caching backend is as easy as providing
a ``CACHE_CONFIG``, constant in your ``superset_config.py`` that
complies with the Flask-Cache specifications.

Flask-Cache supports multiple caching backends (Redis, Memcached,
SimpleCache (in-memory), or the local filesystem). If you are going to use
Memcached please use the `pylibmc` client library as `python-memcached` does
not handle storing binary data correctly. If you use Redis, please install
the `redis <https://pypi.python.org/pypi/redis>`_ Python package: ::

    pip install redis

For setting your timeouts, this is done in the Superset metadata and goes
up the "timeout searchpath", from your slice configuration, to your
data source's configuration, to your database's and ultimately falls back
into your global default defined in ``CACHE_CONFIG``.
	
.. code-block:: python

    CACHE_CONFIG = {
	    'CACHE_TYPE': 'redis',
	    'CACHE_DEFAULT_TIMEOUT': 60 * 60 * 24, # 1 day default (in secs)
	    'CACHE_KEY_PREFIX': 'superset_results',
	    'CACHE_REDIS_URL': 'redis://localhost:6379/0',
	}



Deeper SQLAlchemy integration
-----------------------------

It is possible to tweak the database connection information using the
parameters exposed by SQLAlchemy. In the ``Database`` edit view, you will
find an ``extra`` field as a ``JSON`` blob.

.. image:: images/tutorial/add_db.png
   :scale: 30 %

This JSON string contains extra configuration elements. The ``engine_params``
object gets unpacked into the
`sqlalchemy.create_engine <http://docs.sqlalchemy.org/en/latest/core/engines.html#sqlalchemy.create_engine>`_ call,
while the ``metadata_params`` get unpacked into the
`sqlalchemy.MetaData <http://docs.sqlalchemy.org/en/rel_1_0/core/metadata.html#sqlalchemy.schema.MetaData>`_ call. Refer to the SQLAlchemy docs for more information.


Schemas (Postgres & Redshift)
-----------------------------

Postgres and Redshift, as well as other database,
use the concept of **schema** as a logical entity
on top of the **database**. For Superset to connect to a specific schema,
there's a **schema** parameter you can set in the table form.


External Password store for SQLAlchemy connections
--------------------------------------------------
It is possible to use an external store for you database passwords. This is
useful if you a running a custom secret distribution framework and do not wish
to store secrets in Superset's meta database.

Example:
Write a function that takes a single argument of type ``sqla.engine.url`` and returns
the password for the given connection string. Then set ``SQLALCHEMY_CUSTOM_PASSWORD_STORE``
in your config file to point to that function. ::

    def example_lookup_password(url):
        secret = <<get password from external framework>>
        return 'secret'

    SQLALCHEMY_CUSTOM_PASSWORD_STORE = example_lookup_password

A common pattern is to use environment variables to make secrets available.
``SQLALCHEMY_CUSTOM_PASSWORD_STORE`` can also be used for that purpose. ::

    def example_password_as_env_var(url):
        # assuming the uri looks like
        # mysql://localhost?superset_user:{SUPERSET_PASSWORD}
        return url.password.format(os.environ)

    SQLALCHEMY_CUSTOM_PASSWORD_STORE = example_password_as_env_var


SSL Access to databases
-----------------------
This example worked with a MySQL database that requires SSL. The configuration
may differ with other backends. This is what was put in the ``extra``
parameter ::

    {
        "metadata_params": {},
        "engine_params": {
              "connect_args":{
                  "sslmode":"require",
                  "sslrootcert": "/path/to/my/pem"
            }
         }
    }


Druid
-----

* From the UI, enter the information about your clusters in the
  `Sources -> Druid Clusters` menu by hitting the + sign.

* Once the Druid cluster connection information is entered, hit the
  `Sources -> Refresh Druid Metadata` menu item to populate

* Navigate to your datasources

Note that you can run the ``superset refresh_druid`` command to refresh the
metadata from your Druid cluster(s)


CORS
----

The extra CORS Dependency must be installed:

    superset[cors]


The following keys in `superset_config.py` can be specified to configure CORS:


* ``ENABLE_CORS``: Must be set to True in order to enable CORS
* ``CORS_OPTIONS``: options passed to Flask-CORS (`documentation <http://flask-cors.corydolphin.com/en/latest/api.html#extension>`)


MIDDLEWARE
----------

Superset allows you to add your own middleware. To add your own middleware, update the ``ADDITIONAL_MIDDLEWARE`` key in
your `superset_config.py`. ``ADDITIONAL_MIDDLEWARE`` should be a list of your additional middleware classes.

For example, to use AUTH_REMOTE_USER from behind a proxy server like nginx, you have to add a simple middleware class to
add the value of ``HTTP_X_PROXY_REMOTE_USER`` (or any other custom header from the proxy) to Gunicorn's ``REMOTE_USER``
environment variable: ::

    class RemoteUserMiddleware(object):
        def __init__(self, app):
            self.app = app
        def __call__(self, environ, start_response):
            user = environ.pop('HTTP_X_PROXY_REMOTE_USER', None)
            environ['REMOTE_USER'] = user
            return self.app(environ, start_response)

    ADDITIONAL_MIDDLEWARE = [RemoteUserMiddleware, ]

*Adapted from http://flask.pocoo.org/snippets/69/*


Upgrading
---------

Upgrading should be as straightforward as running::

    pip install superset --upgrade
    superset db upgrade
    superset init

SQL Lab
-------
SQL Lab is a powerful SQL IDE that works with all SQLAlchemy compatible
databases. By default, queries are executed in the scope of a web
request so they
may eventually timeout as queries exceed the maximum duration of a web
request in your environment, whether it'd be a reverse proxy or the Superset
server itself.

On large analytic databases, it's common to run queries that
execute for minutes or hours.
To enable support for long running queries that
execute beyond the typical web request's timeout (30-60 seconds), it is
necessary to configure an asynchronous backend for Superset which consist of:

* one or many Superset worker (which is implemented as a Celery worker), and
  can be started with the ``celery worker`` command, run
  ``celery worker --help`` to view the related options.
* a celery broker (message queue) for which we recommend using Redis
  or RabbitMQ
* a results backend that defines where the worker will persist the query
  results

Configuring Celery requires defining a ``CELERY_CONFIG`` in your
``superset_config.py``. Both the worker and web server processes should
have the same configuration.

.. code-block:: python

    class CeleryConfig(object):
        BROKER_URL = 'redis://localhost:6379/0'
        CELERY_IMPORTS = ('superset.sql_lab', )
        CELERY_RESULT_BACKEND = 'redis://localhost:6379/0'
        CELERY_ANNOTATIONS = {'tasks.add': {'rate_limit': '10/s'}}

    CELERY_CONFIG = CeleryConfig

To start a Celery worker to leverage the configuration run: ::

    celery worker --app=superset.sql_lab:celery_app --pool=gevent -Ofair

To setup a result backend, you need to pass an instance of a derivative
of ``werkzeug.contrib.cache.BaseCache`` to the ``RESULTS_BACKEND``
configuration key in your ``superset_config.py``. It's possible to use
Memcached, Redis, S3 (https://pypi.python.org/pypi/s3werkzeugcache),
memory or the file system (in a single server-type setup or for testing),
or to write your own caching interface. Your ``superset_config.py`` may
look something like:

.. code-block:: python

    # On S3
    from s3cache.s3cache import S3Cache
    S3_CACHE_BUCKET = 'foobar-superset'
    S3_CACHE_KEY_PREFIX = 'sql_lab_result'
    RESULTS_BACKEND = S3Cache(S3_CACHE_BUCKET, S3_CACHE_KEY_PREFIX)

    # On Redis
    from werkzeug.contrib.cache import RedisCache
    RESULTS_BACKEND = RedisCache(
        host='localhost', port=6379, key_prefix='superset_results')

Note that it's important that all the worker nodes and web servers in
the Superset cluster share a common metadata database.
This means that SQLite will not work in this context since it has
limited support for concurrency and
typically lives on the local file system.

Also note that SQL Lab supports Jinja templating in queries, and that it's
possible to overload
the default Jinja context in your environment by defining the
``JINJA_CONTEXT_ADDONS`` in your superset configuration. Objects referenced
in this dictionary are made available for users to use in their SQL.

.. code-block:: python

    JINJA_CONTEXT_ADDONS = {
        'my_crazy_macro': lambda x: x*2,
    }


Flower is a web based tool for monitoring the Celery cluster which you can
install from pip: ::

    pip install flower

and run via: ::

    celery flower --app=superset.sql_lab:celery_app

Making your own build
---------------------

For more advanced users, you may want to build Superset from sources. That
would be the case if you fork the project to add features specific to
your environment.::

    # assuming $SUPERSET_HOME as the root of the repo
    cd $SUPERSET_HOME/superset/assets
    yarn
    yarn run build
    cd $SUPERSET_HOME
    python setup.py install


Blueprints
----------

`Blueprints are Flask's reusable apps <http://flask.pocoo.org/docs/0.12/blueprints/>`_.
Superset allows you to specify an array of Blueprints
in your ``superset_config`` module. Here's
an example on how this can work with a simple Blueprint. By doing
so, you can expect Superset to serve a page that says "OK"
at the ``/simple_page`` url. This can allow you to run other things such
as custom data visualization applications alongside Superset, on the
same server.

.. code-block:: python

    from flask import Blueprint
    simple_page = Blueprint('simple_page', __name__,
                                    template_folder='templates')
    @simple_page.route('/', defaults={'page': 'index'})
    @simple_page.route('/<page>')
    def show(page):
        return "Ok"

    BLUEPRINTS = [simple_page]

StatsD logging
--------------

Superset is instrumented to log events to StatsD if desired. Most endpoints hit
are logged as well as key events like query start and end in SQL Lab.

To setup StatsD logging, it's a matter of configuring the logger in your
``superset_config.py``.

.. code-block:: python

    from superset.stats_logger import StatsdStatsLogger
    STATS_LOGGER = StatsdStatsLogger(host='localhost', port=8125, prefix='superset')

Note that it's also possible to implement you own logger by deriving
``superset.stats_logger.BaseStatsLogger``.


Install Superset with helm in Kubernetes
--------------

You can install Superset into Kubernetes with Helm <https://helm.sh/>. The chart is 
located in ``install/helm``.

To install Superset into your Kubernetes:

.. code-block:: bash

    helm upgrade --install superset ./install/helm/superset 

Note that the above command will install Superset into ``default`` namespace of your Kubernetes cluster.
