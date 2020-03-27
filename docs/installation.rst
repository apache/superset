..  Licensed to the Apache Software Foundation (ASF) under one
    or more contributor license agreements.  See the NOTICE file
    distributed with this work for additional information
    regarding copyright ownership.  The ASF licenses this file
    to you under the Apache License, Version 2.0 (the
    "License"); you may not use this file except in compliance
    with the License.  You may obtain a copy of the License at

..    http://www.apache.org/licenses/LICENSE-2.0

..  Unless required by applicable law or agreed to in writing,
    software distributed under the License is distributed on an
    "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
    KIND, either express or implied.  See the License for the
    specific language governing permissions and limitations
    under the License.

Installation & Configuration
============================

Getting Started
---------------

Superset has deprecated support for Python ``2.*`` and supports
only ``~=3.6`` to take advantage of the newer Python features and reduce
the burden of supporting previous versions. We run our test suite
against ``3.6``, but ``3.7`` is fully supported as well.

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
(Memcached, Redis, ...), works well with services like NewRelic, StatsD and
DataDog, and has the ability to run analytic workloads against
most popular database technologies.

Superset is battle tested in large environments with hundreds
of concurrent users. Airbnb's production environment runs inside
Kubernetes and serves 600+ daily active users viewing over 100K charts a
day.

The Superset web server and the Superset Celery workers (optional)
are stateless, so you can scale out by running on as many servers
as needed.

Start with Docker
-----------------

.. note ::
    The Docker-related files and documentation are actively maintained and
    managed by the core committers working on the project. Help and contributions
    around Docker are welcomed!

If you know docker, then you're lucky, we have shortcut road for you to
initialize development environment: ::

    git clone https://github.com/apache/incubator-superset/
    cd incubator-superset
    # you can run this command everytime you need to start superset now:
    docker-compose up

After several minutes for superset initialization to finish, you can open
a browser and view `http://localhost:8088` to start your journey. By default
the system configures an admin user with the username of `admin` and a password
of `admin` - if you are in a non-local environment it is highly recommended to
change this username and password at your earliest convenience.

From there, the container server will reload on modification of the superset python
and javascript source code.
Don't forget to reload the page to take the new frontend into account though.

See also `CONTRIBUTING.md#building <https://github.com/apache/incubator-superset/blob/master/CONTRIBUTING.md#building>`_,
for alternative way of serving the frontend.

It is currently not recommended to run docker-compose in production.

If you are attempting to build on a Mac and it exits with 137 you need to increase your docker resources.
OSX instructions: https://docs.docker.com/docker-for-mac/#advanced (Search for memory)

Or if you're curious and want to install superset from bottom up, then go ahead.

See also `docker/README.md <https://github.com/apache/incubator-superset/blob/master/docker/README.md>`_

OS dependencies
---------------

Superset stores database connection information in its metadata database.
For that purpose, we use the ``cryptography`` Python library to encrypt
connection passwords. Unfortunately, this library has OS level dependencies.

You may want to attempt the next step
("Superset installation and initialization") and come back to this step if
you encounter an error.

Here's how to install them:

For **Debian** and **Ubuntu**, the following command will ensure that
the required dependencies are installed: ::

    sudo apt-get install build-essential libssl-dev libffi-dev python-dev python-pip libsasl2-dev libldap2-dev

**Ubuntu 18.04** If you have python3.6 installed alongside with python2.7, as is default on **Ubuntu 18.04 LTS**, run this command also: ::

    sudo apt-get install build-essential libssl-dev libffi-dev python3.6-dev python-pip libsasl2-dev libldap2-dev

otherwise build for ``cryptography`` fails.

For **Fedora** and **RHEL-derivatives**, the following command will ensure
that the required dependencies are installed: ::

    sudo yum upgrade python-setuptools
    sudo yum install gcc gcc-c++ libffi-devel python-devel python-pip python-wheel openssl-devel cyrus-sasl-devel openldap-devel

**Mac OS X** If possible, you should upgrade to the latest version of OS X as issues are more likely to be resolved for that version.
You *will likely need* the latest version of XCode available for your installed version of OS X. You should also install
the XCode command line tools: ::

    xcode-select --install

System python is not recommended. Homebrew's python also ships with pip: ::

    brew install pkg-config libffi openssl python
    env LDFLAGS="-L$(brew --prefix openssl)/lib" CFLAGS="-I$(brew --prefix openssl)/include" pip install cryptography==2.4.2

**Windows** isn't officially supported at this point, but if you want to
attempt it, download `get-pip.py <https://bootstrap.pypa.io/get-pip.py>`_, and run ``python get-pip.py`` which may need admin access. Then run the following: ::

    C:\> pip install cryptography

    # You may also have to create C:\Temp
    C:\> md C:\Temp

Python virtualenv
-----------------
It is recommended to install Superset inside a virtualenv. Python 3 already ships virtualenv.
But if it's not installed in your environment for some reason, you can install it
via the package for your operating systems, otherwise you can install from pip: ::

    pip install virtualenv

You can create and activate a virtualenv by: ::

    # virtualenv is shipped in Python 3.6+ as venv instead of pyvenv.
    # See https://docs.python.org/3.6/library/venv.html
    python3 -m venv venv
    . venv/bin/activate

On Windows the syntax for activating it is a bit different: ::

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
    pip install apache-superset

    # Initialize the database
    superset db upgrade

    # Create an admin user (you will be prompted to set a username, first and last name before setting a password)
    $ export FLASK_APP=superset
    superset fab create-admin

    # Load some data to play with
    superset load_examples

    # Create default roles and permissions
    superset init

    # To start a development web server on port 8088, use -p to bind to another port
    superset run -p 8088 --with-threads --reload --debugger

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
        "superset.app:create_app()"

Refer to the
`Gunicorn documentation <https://docs.gunicorn.org/en/stable/design.html>`_
for more information.

Note that the development web
server (`superset run` or `flask run`) is not intended for production use.

If not using gunicorn, you may want to disable the use of flask-compress
by setting `ENABLE_FLASK_COMPRESS = False` in your `superset_config.py`

Flask-AppBuilder Permissions
----------------------------

By default, every time the Flask-AppBuilder (FAB) app is initialized the
permissions and views are added automatically to the backend and associated with
the ‘Admin’ role. The issue, however, is when you are running multiple concurrent
workers this creates a lot of contention and race conditions when defining
permissions and views.

To alleviate this issue, the automatic updating of permissions can be disabled
by setting `FAB_UPDATE_PERMS = False` (defaults to True).

In a production environment initialization could take on the following form:

  superset init
  gunicorn -w 10 ... superset:app

Configuration behind a load balancer
------------------------------------

If you are running superset behind a load balancer or reverse proxy (e.g. NGINX
or ELB on AWS), you may need to utilise a healthcheck endpoint so that your
load balancer knows if your superset instance is running. This is provided
at ``/health`` which will return a 200 response containing "OK" if the
the webserver is running.

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
<https://flask-appbuilder.readthedocs.org/en/latest/config.html>`_
for more information on how to configure it.

Make sure to change:

* *SQLALCHEMY_DATABASE_URI*, by default it is stored at *~/.superset/superset.db*
* *SECRET_KEY*, to a long random string

In case you need to exempt endpoints from CSRF, e.g. you are running a custom
auth postback endpoint, you can add them to *WTF_CSRF_EXEMPT_LIST*

     WTF_CSRF_EXEMPT_LIST = ['']


.. _ref_database_deps:

Database dependencies
---------------------

Superset does not ship bundled with connectivity to databases, except
for Sqlite, which is part of the Python standard library.
You'll need to install the required packages for the database you
want to use as your metadata database as well as the packages needed to
connect to the databases you want to access through Superset.

Here's a list of some of the recommended packages.

+------------------+---------------------------------------+-------------------------------------------------+
| database         | pypi package                          | SQLAlchemy URI prefix                           |
+==================+=======================================+=================================================+
| Amazon Athena    | ``pip install "PyAthenaJDBC>1.0.9"``  | ``awsathena+jdbc://``                           |
+------------------+---------------------------------------+-------------------------------------------------+
| Amazon Athena    | ``pip install "PyAthena>1.2.0"``      | ``awsathena+rest://``                           |
+------------------+---------------------------------------+-------------------------------------------------+
| Amazon Redshift  | ``pip install sqlalchemy-redshift``   | ``redshift+psycopg2://``                        |
+------------------+---------------------------------------+-------------------------------------------------+
| Apache Drill     | ``pip install sqlalchemy-drill``      | For the REST API:``                             |
|                  |                                       | ``drill+sadrill://``                            |
|                  |                                       | For JDBC                                        |
|                  |                                       | ``drill+jdbc://``                               |
+------------------+---------------------------------------+-------------------------------------------------+
| Apache Druid     | ``pip install pydruid``               | ``druid://``                                    |
+------------------+---------------------------------------+-------------------------------------------------+
| Apache Hive      | ``pip install pyhive``                | ``hive://``                                     |
+------------------+---------------------------------------+-------------------------------------------------+
| Apache Impala    | ``pip install impyla``                | ``impala://``                                   |
+------------------+---------------------------------------+-------------------------------------------------+
| Apache Kylin     | ``pip install kylinpy``               | ``kylin://``                                    |
+------------------+---------------------------------------+-------------------------------------------------+
| Apache Pinot     | ``pip install pinotdb``               | ``pinot+http://CONTROLLER:5436/``               |
|                  |                                       | ``query?server=http://CONTROLLER:5983/``        |
+------------------+---------------------------------------+-------------------------------------------------+
| Apache Spark SQL | ``pip install pyhive``                | ``jdbc+hive://``                                |
+------------------+---------------------------------------+-------------------------------------------------+
| BigQuery         | ``pip install pybigquery``            | ``bigquery://``                                 |
+------------------+---------------------------------------+-------------------------------------------------+
| ClickHouse       | ``pip install sqlalchemy-clickhouse`` |                                                 |
+------------------+---------------------------------------+-------------------------------------------------+
| CockroachDB      | ``pip install cockroachdb``           | ``cockroachdb://``                              |
+------------------+---------------------------------------+-------------------------------------------------+
| Dremio           | ``pip install sqlalchemy_dremio``     | ``dremio://user:pwd@host:31010/``               |
+------------------+---------------------------------------+-------------------------------------------------+
| Elasticsearch    | ``pip install elasticsearch-dbapi``   | ``elasticsearch+http://``                       |
+------------------+---------------------------------------+-------------------------------------------------+
| Exasol           | ``pip install sqlalchemy-exasol``     | ``exa+pyodbc://``                               |
+------------------+---------------------------------------+-------------------------------------------------+
| Google Sheets    | ``pip install gsheetsdb``             | ``gsheets://``                                  |
+------------------+---------------------------------------+-------------------------------------------------+
| IBM Db2          | ``pip install ibm_db_sa``             | ``db2+ibm_db://``                               |
+------------------+---------------------------------------+-------------------------------------------------+
| MySQL            | ``pip install mysqlclient``           | ``mysql://``                                    |
+------------------+---------------------------------------+-------------------------------------------------+
| Oracle           | ``pip install cx_Oracle``             | ``oracle://``                                   |
+------------------+---------------------------------------+-------------------------------------------------+
| PostgreSQL       | ``pip install psycopg2``              | ``postgresql+psycopg2://``                      |
+------------------+---------------------------------------+-------------------------------------------------+
| Presto           | ``pip install pyhive``                | ``presto://``                                   |
+------------------+---------------------------------------+-------------------------------------------------+
| Snowflake        | ``pip install snowflake-sqlalchemy``  | ``snowflake://``                                |
+------------------+---------------------------------------+-------------------------------------------------+
| SQLite           |                                       | ``sqlite://``                                   |
+------------------+---------------------------------------+-------------------------------------------------+
| SQL Server       | ``pip install pymssql``               | ``mssql://``                                    |
+------------------+---------------------------------------+-------------------------------------------------+
| Teradata         | ``pip install sqlalchemy-teradata``   | ``teradata://``                                 |
+------------------+---------------------------------------+-------------------------------------------------+
| Vertica          | ``pip install                         |  ``vertica+vertica_python://``                  |
|                  | sqlalchemy-vertica-python``           |                                                 |
+------------------+---------------------------------------+-------------------------------------------------+
| Hana             | ``pip install hdbcli sqlalchemy-hana``|  ``hana://``                                    |
|                  | or                                    |                                                 |
|                  | ``pip install apache-superset[hana]`` |                                                 |
+------------------+---------------------------------------+-------------------------------------------------+


Note that many other databases are supported, the main criteria being the
existence of a functional SqlAlchemy dialect and Python driver. Googling
the keyword ``sqlalchemy`` in addition of a keyword that describes the
database you want to connect to should get you to the right place.

Hana
------------

The connection string for Hana looks like this ::

    hana://{username}:{password}@{host}:{port}


(AWS) Athena
------------

The connection string for Athena looks like this ::

    awsathena+jdbc://{aws_access_key_id}:{aws_secret_access_key}@athena.{region_name}.amazonaws.com/{schema_name}?s3_staging_dir={s3_staging_dir}&...

Where you need to escape/encode at least the s3_staging_dir, i.e., ::

    s3://... -> s3%3A//...

You can also use `PyAthena` library(no java required) like this ::

    awsathena+rest://{aws_access_key_id}:{aws_secret_access_key}@athena.{region_name}.amazonaws.com/{schema_name}?s3_staging_dir={s3_staging_dir}&...

See `PyAthena <https://github.com/laughingman7743/PyAthena#sqlalchemy>`_.

(Google) BigQuery
-----------------

The connection string for BigQuery looks like this ::

    bigquery://{project_id}

Additionally, you will need to configure authentication via a
Service Account. Create your Service Account via the Google
Cloud Platform control panel, provide it access to the appropriate
BigQuery datasets, and download the JSON configuration file
for the service account. In Superset, Add a JSON blob to
the "Secure Extra" field in the database configuration page
with the following format ::

    {
        "credentials_info": <contents of credentials JSON file>
    }

The resulting file should have this structure ::

    {
        "credentials_info": {
            "type": "service_account",
            "project_id": "...",
            "private_key_id": "...",
            "private_key": "...",
            "client_email": "...",
            "client_id": "...",
            "auth_uri": "...",
            "token_uri": "...",
            "auth_provider_x509_cert_url": "...",
            "client_x509_cert_url": "...",
        }
    }

You should then be able to connect to your BigQuery datasets.

To be able to upload data, e.g. sample data, the python library `pandas_gbq` is required.


Elasticsearch
-------------

The connection string for Elasticsearch looks like this ::

    elasticsearch+http://{user}:{password}@{host}:9200/

Using HTTPS ::

    elasticsearch+https://{user}:{password}@{host}:9200/


Elasticsearch as a default limit of 10000 rows, so you can increase this limit on your cluster
or set Superset's row limit on config ::

    ROW_LIMIT = 10000

You can query multiple indices on SQLLab for example ::

    select timestamp, agent from "logstash-*"

But, to use visualizations for multiple indices you need to create an alias index on your cluster ::

    POST /_aliases
    {
        "actions" : [
            { "add" : { "index" : "logstash-**", "alias" : "logstash_all" } }
        ]
    }

Then register your table with the ``alias`` name ``logstasg_all``

Snowflake
---------

The connection string for Snowflake looks like this ::

    snowflake://{user}:{password}@{account}.{region}/{database}?role={role}&warehouse={warehouse}

The schema is not necessary in the connection string, as it is defined per table/query.
The role and warehouse can be omitted if defaults are defined for the user, i.e.

    snowflake://{user}:{password}@{account}.{region}/{database}

Make sure the user has privileges to access and use all required
databases/schemas/tables/views/warehouses, as the Snowflake SQLAlchemy engine does
not test for user/role rights during engine creation by default. However, when
pressing the "Test Connection" button in the Create or Edit Database dialog,
user/role credentials are validated by passing `"validate_default_parameters": True`
to the `connect()` method during engine creation. If the user/role is not authorized
to access the database, an error is recorded in the Superset logs.

See `Snowflake SQLAlchemy <https://github.com/snowflakedb/snowflake-sqlalchemy>`_.

Teradata
---------

The connection string for Teradata looks like this ::

    teradata://{user}:{password}@{host}

*Note*: Its required to have Teradata ODBC drivers installed and environment variables configured for proper work of sqlalchemy dialect. Teradata ODBC Drivers available here: https://downloads.teradata.com/download/connectivity/odbc-driver/linux

Required environment variables: ::

    export ODBCINI=/.../teradata/client/ODBC_64/odbc.ini
    export ODBCINST=/.../teradata/client/ODBC_64/odbcinst.ini

See `Teradata SQLAlchemy <https://github.com/Teradata/sqlalchemy-teradata>`_.

Apache Drill
------------
At the time of writing, the SQLAlchemy Dialect is not available on pypi and must be downloaded here:
`SQLAlchemy Drill <https://github.com/JohnOmernik/sqlalchemy-drill>`_

Alternatively, you can install it completely from the command line as follows: ::

    git clone https://github.com/JohnOmernik/sqlalchemy-drill
    cd sqlalchemy-drill
    python3 setup.py install

Once that is done, you can connect to Drill in two ways, either via the REST interface or by JDBC.  If you are connecting via JDBC, you must have the
Drill JDBC Driver installed.

The basic connection string for Drill looks like this ::

    drill+sadrill://{username}:{password}@{host}:{port}/{storage_plugin}?use_ssl=True

If you are using JDBC to connect to Drill, the connection string looks like this: ::

    drill+jdbc://{username}:{password}@{host}:{port}/{storage_plugin}

For a complete tutorial about how to use Apache Drill with Superset, see this tutorial:
`Visualize Anything with Superset and Drill <http://thedataist.com/visualize-anything-with-superset-and-drill/>`_

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

It is also possible to pass a custom cache initialization function in the
config to handle additional caching use cases. The function must return an
object that is compatible with the `Flask-Cache <https://pythonhosted.org/Flask-Cache/>`_ API.

.. code-block:: python

    from custom_caching import CustomCache

    def init_cache(app):
        """Takes an app instance and returns a custom cache backend"""
        config = {
            'CACHE_DEFAULT_TIMEOUT': 60 * 60 * 24, # 1 day default (in secs)
            'CACHE_KEY_PREFIX': 'superset_results',
        }
        return CustomCache(app, config)

    CACHE_CONFIG = init_cache

Superset has a Celery task that will periodically warm up the cache based on
different strategies. To use it, add the following to the `CELERYBEAT_SCHEDULE`
section in `config.py`:

.. code-block:: python

    CELERYBEAT_SCHEDULE = {
        'cache-warmup-hourly': {
            'task': 'cache-warmup',
            'schedule': crontab(minute=0, hour='*'),  # hourly
            'kwargs': {
                'strategy_name': 'top_n_dashboards',
                'top_n': 5,
                'since': '7 days ago',
            },
        },
    }

This will cache all the charts in the top 5 most popular dashboards every hour.
For other strategies, check the `superset/tasks/cache.py` file.


Deeper SQLAlchemy integration
-----------------------------

It is possible to tweak the database connection information using the
parameters exposed by SQLAlchemy. In the ``Database`` edit view, you will
find an ``extra`` field as a ``JSON`` blob.

.. image:: _static/images/tutorial/add_db.png
   :scale: 30 %

This JSON string contains extra configuration elements. The ``engine_params``
object gets unpacked into the
`sqlalchemy.create_engine <https://docs.sqlalchemy.org/en/latest/core/engines.html#sqlalchemy.create_engine>`_ call,
while the ``metadata_params`` get unpacked into the
`sqlalchemy.MetaData <https://docs.sqlalchemy.org/en/rel_1_2/core/metadata.html#sqlalchemy.schema.MetaData>`_ call. Refer to the SQLAlchemy docs for more information.

.. note:: If your using CTAS on SQLLab and PostgreSQL
    take a look at :ref:`ref_ctas_engine_config` for specific ``engine_params``.


Schemas (Postgres & Redshift)
-----------------------------

Postgres and Redshift, as well as other databases,
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

The native Druid connector (behind the ``DRUID_IS_ACTIVE`` feature flag)
is slowly getting deprecated in favor of the SQLAlchemy/DBAPI connector made
available in the ``pydruid`` library.

To use a custom SSL certificate to validate HTTPS requests, the certificate
contents can be entered in the ``Root Certificate`` field in the Database
dialog. When using a custom certificate, ``pydruid`` will automatically use
``https`` scheme. To disable SSL verification add the following to extras:
``engine_params": {"connect_args": {"scheme": "https", "ssl_verify_cert": false}}``

Dremio
------

Install the following dependencies to connect to Dremio:

* Dremio SQLAlchemy: ``pip install sqlalchemy_dremio``
* Dremio's ODBC driver: https://www.dremio.com/drivers/

Example SQLAlchemy URI: ``dremio://dremio:dremio123@localhost:31010/dremio``

Presto
------

By default Superset assumes the most recent version of Presto is being used when
querying the datasource. If you're using an older version of presto, you can configure
it in the ``extra`` parameter::

    {
        "version": "0.123"
    }


Exasol
---------

The connection string for Exasol looks like this ::

    exa+pyodbc://{user}:{password}@{host}

*Note*: It's required to have Exasol ODBC drivers installed for the sqlalchemy dialect to work properly. Exasol ODBC Drivers available are here: https://www.exasol.com/portal/display/DOWNLOAD/Exasol+Download+Section

Example config (odbcinst.ini can be left empty) ::

    $ cat $/.../path/to/odbc.ini
    [EXAODBC]
    DRIVER = /.../path/to/driver/EXASOL_driver.so
    EXAHOST = host:8563
    EXASCHEMA = main

See `SQLAlchemy for Exasol <https://github.com/blue-yonder/sqlalchemy_exasol>`_.

CORS
----

The extra CORS Dependency must be installed:

.. code-block:: text

    pip install apache-superset[cors]

The following keys in `superset_config.py` can be specified to configure CORS:


* ``ENABLE_CORS``: Must be set to True in order to enable CORS
* ``CORS_OPTIONS``: options passed to Flask-CORS (`documentation <https://flask-cors.corydolphin.com/en/latest/api.html#extension>`)


Domain Sharding
---------------

Chrome allows up to 6 open connections per domain at a time. When there are more
than 6 slices in dashboard, a lot of time fetch requests are queued up and wait for
next available socket. `PR 5039 <https://github.com/apache/incubator-superset/pull/5039>`_ adds domain sharding to Superset,
and this feature will be enabled by configuration only (by default Superset
doesn't allow cross-domain request).

* ``SUPERSET_WEBSERVER_DOMAINS``: list of allowed hostnames for domain sharding feature. default `None`


Middleware
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

Event Logging
-------------

Superset by default logs special action event on it's database. These log can be accessed on the UI navigating to
"Security" -> "Action Log". You can freely customize these logs by implementing your own event log class.

Example of a simple JSON to Stdout class::

    class JSONStdOutEventLogger(AbstractEventLogger):

        def log(self, user_id, action, *args, **kwargs):
            records = kwargs.get('records', list())
            dashboard_id = kwargs.get('dashboard_id')
            slice_id = kwargs.get('slice_id')
            duration_ms = kwargs.get('duration_ms')
            referrer = kwargs.get('referrer')

            for record in records:
                log = dict(
                    action=action,
                    json=record,
                    dashboard_id=dashboard_id,
                    slice_id=slice_id,
                    duration_ms=duration_ms,
                    referrer=referrer,
                    user_id=user_id
                )
                print(json.dumps(log))


Then on Superset's config pass an instance of the logger type you want to use.

    EVENT_LOGGER = JSONStdOutEventLogger()


Upgrading
---------

Upgrading should be as straightforward as running::

    pip install apache-superset --upgrade
    superset db upgrade
    superset init

We recommend to follow standard best practices when upgrading Superset, such
as taking a database backup prior to the upgrade, upgrading a staging
environment prior to upgrading production, and upgrading production while less
users are active on the platform.

.. note ::
   Some upgrades may contain backward-incompatible changes, or require
   scheduling downtime, when that is the case, contributors attach notes in
   ``UPDATING.md`` in the repository. It's recommended to review this
   file prior to running an upgrade.


Celery Tasks
------------

On large analytic databases, it's common to run queries that
execute for minutes or hours.
To enable support for long running queries that
execute beyond the typical web request's timeout (30-60 seconds), it is
necessary to configure an asynchronous backend for Superset which consists of:

* one or many Superset workers (which is implemented as a Celery worker), and
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
        CELERY_IMPORTS = (
            'superset.sql_lab',
            'superset.tasks',
        )
        CELERY_RESULT_BACKEND = 'redis://localhost:6379/0'
        CELERYD_LOG_LEVEL = 'DEBUG'
        CELERYD_PREFETCH_MULTIPLIER = 10
        CELERY_ACKS_LATE = True
        CELERY_ANNOTATIONS = {
            'sql_lab.get_sql_results': {
                'rate_limit': '100/s',
            },
            'email_reports.send': {
                'rate_limit': '1/s',
                'time_limit': 120,
                'soft_time_limit': 150,
                'ignore_result': True,
            },
        }
        CELERYBEAT_SCHEDULE = {
            'email_reports.schedule_hourly': {
                'task': 'email_reports.schedule_hourly',
                'schedule': crontab(minute=1, hour='*'),
            },
        }

    CELERY_CONFIG = CeleryConfig

* To start a Celery worker to leverage the configuration run: ::

    celery worker --app=superset.tasks.celery_app:app --pool=prefork -O fair -c 4

* To start a job which schedules periodic background jobs, run ::

    celery beat --app=superset.tasks.celery_app:app

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

For performance gains, `MessagePack <https://github.com/msgpack/msgpack-python>`_
and `PyArrow <https://arrow.apache.org/docs/python/>`_ are now used for results
serialization. This can be disabled by setting ``RESULTS_BACKEND_USE_MSGPACK = False``
in your configuration, should any issues arise. Please clear your existing results
cache store when upgrading an existing environment.

**Important notes**

* It is important that all the worker nodes and web servers in
  the Superset cluster share a common metadata database.
  This means that SQLite will not work in this context since it has
  limited support for concurrency and
  typically lives on the local file system.

* There should only be one instance of ``celery beat`` running in your
  entire setup. If not, background jobs can get scheduled multiple times
  resulting in weird behaviors like duplicate delivery of reports,
  higher than expected load / traffic etc.

* SQL Lab will only run your queries asynchronously if you enable
  "Asynchronous Query Execution" in your database settings.


Email Reports
-------------
Email reports allow users to schedule email reports for

* chart and dashboard visualization (Attachment or inline)
* chart data (CSV attachment on inline table)

**Setup**

Make sure you enable email reports in your configuration file

.. code-block:: python

    ENABLE_SCHEDULED_EMAIL_REPORTS = True

Now you will find two new items in the navigation bar that allow you to schedule email
reports

* Manage -> Dashboard Emails
* Manage -> Chart Email Schedules

Schedules are defined in crontab format and each schedule
can have a list of recipients (all of them can receive a single mail,
or separate mails). For audit purposes, all outgoing mails can have a
mandatory bcc.

In order get picked up you need to configure a celery worker and a celery beat
(see section above "Celery Tasks"). Your celery configuration also
needs an entry ``email_reports.schedule_hourly`` for ``CELERYBEAT_SCHEDULE``.

To send emails you need to configure SMTP settings in your configuration file. e.g.

.. code-block:: python

    EMAIL_NOTIFICATIONS = True

    SMTP_HOST = "email-smtp.eu-west-1.amazonaws.com"
    SMTP_STARTTLS = True
    SMTP_SSL = False
    SMTP_USER = "smtp_username"
    SMTP_PORT = 25
    SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD")
    SMTP_MAIL_FROM = "insights@komoot.com"


To render dashboards you need to install a local browser on your superset instance

  * `geckodriver <https://github.com/mozilla/geckodriver>`_ and Firefox is preferred
  * `chromedriver <http://chromedriver.chromium.org/>`_ is a good option too

You need to adjust the ``EMAIL_REPORTS_WEBDRIVER`` accordingly in your configuration.

You also need to specify on behalf of which username to render the dashboards. In general
dashboards and charts are not accessible to unauthorized requests, that is why the
worker needs to take over credentials of an existing user to take a snapshot. ::

    EMAIL_REPORTS_USER = 'username_with_permission_to_access_dashboards'


**Important notes**

* Be mindful of the concurrency setting for celery (using ``-c 4``).
  Selenium/webdriver instances can consume a lot of CPU / memory on your servers.

* In some cases, if you notice a lot of leaked ``geckodriver`` processes, try running
  your celery processes with ::

    celery worker --pool=prefork --max-tasks-per-child=128 ...

* It is recommended to run separate workers for ``sql_lab`` and
  ``email_reports`` tasks. Can be done by using ``queue`` field in ``CELERY_ANNOTATIONS``

* Adjust ``WEBDRIVER_BASEURL`` in your config if celery workers can't access superset via its
  default value ``http://0.0.0.0:8080/`` (notice the port number 8080, many other setups use
  port 8088).

SQL Lab
-------
SQL Lab is a powerful SQL IDE that works with all SQLAlchemy compatible
databases. By default, queries are executed in the scope of a web
request so they may eventually timeout as queries exceed the maximum duration of a web
request in your environment, whether it'd be a reverse proxy or the Superset
server itself. In such cases, it is preferred to use ``celery`` to run the queries
in the background. Please follow the examples/notes mentioned above to get your
celery setup working.

Also note that SQL Lab supports Jinja templating in queries and that it's
possible to overload
the default Jinja context in your environment by defining the
``JINJA_CONTEXT_ADDONS`` in your superset configuration. Objects referenced
in this dictionary are made available for users to use in their SQL.

.. code-block:: python

    JINJA_CONTEXT_ADDONS = {
        'my_crazy_macro': lambda x: x*2,
    }

SQL Lab also includes a live query validation feature with pluggable backends.
You can configure which validation implementation is used with which database
engine by adding a block like the following to your config.py:

.. code-block:: python

     FEATURE_FLAGS = {
         'SQL_VALIDATORS_BY_ENGINE': {
             'presto': 'PrestoDBSQLValidator',
         }
     }

The available validators and names can be found in `sql_validators/`.

**Scheduling queries**

You can optionally allow your users to schedule queries directly in SQL Lab.
This is done by addding extra metadata to saved queries, which are then picked
up by an external scheduled (like [Apache Airflow](https://airflow.apache.org/)).

To allow scheduled queries, add the following to your `config.py`:

.. code-block:: python

    FEATURE_FLAGS = {
        # Configuration for scheduling queries from SQL Lab. This information is
        # collected when the user clicks "Schedule query", and saved into the `extra`
        # field of saved queries.
        # See: https://github.com/mozilla-services/react-jsonschema-form
        'SCHEDULED_QUERIES': {
            'JSONSCHEMA': {
                'title': 'Schedule',
                'description': (
                    'In order to schedule a query, you need to specify when it '
                    'should start running, when it should stop running, and how '
                    'often it should run. You can also optionally specify '
                    'dependencies that should be met before the query is '
                    'executed. Please read the documentation for best practices '
                    'and more information on how to specify dependencies.'
                ),
                'type': 'object',
                'properties': {
                    'output_table': {
                        'type': 'string',
                        'title': 'Output table name',
                    },
                    'start_date': {
                        'type': 'string',
                        'title': 'Start date',
                        # date-time is parsed using the chrono library, see
                        # https://www.npmjs.com/package/chrono-node#usage
                        'format': 'date-time',
                        'default': 'tomorrow at 9am',
                    },
                    'end_date': {
                        'type': 'string',
                        'title': 'End date',
                        # date-time is parsed using the chrono library, see
                        # https://www.npmjs.com/package/chrono-node#usage
                        'format': 'date-time',
                        'default': '9am in 30 days',
                    },
                    'schedule_interval': {
                        'type': 'string',
                        'title': 'Schedule interval',
                    },
                    'dependencies': {
                        'type': 'array',
                        'title': 'Dependencies',
                        'items': {
                            'type': 'string',
                        },
                    },
                },
            },
            'UISCHEMA': {
                'schedule_interval': {
                    'ui:placeholder': '@daily, @weekly, etc.',
                },
                'dependencies': {
                    'ui:help': (
                        'Check the documentation for the correct format when '
                        'defining dependencies.'
                    ),
                },
            },
            'VALIDATION': [
                # ensure that start_date <= end_date
                {
                    'name': 'less_equal',
                    'arguments': ['start_date', 'end_date'],
                    'message': 'End date cannot be before start date',
                    # this is where the error message is shown
                    'container': 'end_date',
                },
            ],
            # link to the scheduler; this example links to an Airflow pipeline
            # that uses the query id and the output table as its name
            'linkback': (
                'https://airflow.example.com/admin/airflow/tree?'
                'dag_id=query_${id}_${extra_json.schedule_info.output_table}'
            ),
        },
    }

This feature flag is based on [react-jsonschema-form](https://github.com/mozilla-services/react-jsonschema-form),
and will add a button called "Schedule Query" to SQL Lab. When the button is
clicked, a modal will show up where the user can add the metadata required for
scheduling the query.

This information can then be retrieved from the endpoint `/savedqueryviewapi/api/read`
and used to schedule the queries that have `scheduled_queries` in their JSON
metadata. For schedulers other than Airflow, additional fields can be easily
added to the configuration file above.

Celery Flower
-------------
Flower is a web based tool for monitoring the Celery cluster which you can
install from pip: ::

    pip install flower

and run via: ::

    celery flower --app=superset.tasks.celery_app:app

Building from source
---------------------

More advanced users may want to build Superset from sources. That
would be the case if you fork the project to add features specific to
your environment. See `CONTRIBUTING.md#setup-local-environment-for-development <https://github.com/apache/incubator-superset/blob/master/CONTRIBUTING.md#setup-local-environment-for-development>`_.

Blueprints
----------

`Blueprints are Flask's reusable apps <https://flask.palletsprojects.com/en/1.0.x/tutorial/views/>`_.
Superset allows you to specify an array of Blueprints
in your ``superset_config`` module. Here's
an example of how this can work with a simple Blueprint. By doing
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
----------------------------------------

You can install Superset into Kubernetes with Helm <https://helm.sh/>. The chart is
located in ``install/helm``.

To install Superset into your Kubernetes:

.. code-block:: bash

    helm upgrade --install superset ./install/helm/superset

Note that the above command will install Superset into ``default`` namespace of your Kubernetes cluster.

Custom OAuth2 configuration
---------------------------

Beyond FAB supported providers (github, twitter, linkedin, google, azure), its easy to connect Superset with other OAuth2 Authorization Server implementations that support "code" authorization.

The first step: Configure authorization in Superset ``superset_config.py``.

.. code-block:: python

    AUTH_TYPE = AUTH_OAUTH
    OAUTH_PROVIDERS = [
        {   'name':'egaSSO',
            'token_key':'access_token', # Name of the token in the response of access_token_url
            'icon':'fa-address-card',   # Icon for the provider
            'remote_app': {
                'consumer_key':'myClientId',  # Client Id (Identify Superset application)
                'consumer_secret':'MySecret', # Secret for this Client Id (Identify Superset application)
                'request_token_params':{
                    'scope': 'read'               # Scope for the Authorization
                },
                'access_token_method':'POST',    # HTTP Method to call access_token_url
                'access_token_params':{        # Additional parameters for calls to access_token_url
                    'client_id':'myClientId'
                },
                'access_token_headers':{    # Additional headers for calls to access_token_url
                    'Authorization': 'Basic Base64EncodedClientIdAndSecret'
                },
                'base_url':'https://myAuthorizationServer/oauth2AuthorizationServer/',
                'access_token_url':'https://myAuthorizationServer/oauth2AuthorizationServer/token',
                'authorize_url':'https://myAuthorizationServer/oauth2AuthorizationServer/authorize'
            }
        }
    ]

    # Will allow user self registration, allowing to create Flask users from Authorized User
    AUTH_USER_REGISTRATION = True

    # The default user self registration role
    AUTH_USER_REGISTRATION_ROLE = "Public"

Second step: Create a `CustomSsoSecurityManager` that extends `SupersetSecurityManager` and overrides `oauth_user_info`:

.. code-block:: python

    from superset.security import SupersetSecurityManager

    class CustomSsoSecurityManager(SupersetSecurityManager):

        def oauth_user_info(self, provider, response=None):
            logging.debug("Oauth2 provider: {0}.".format(provider))
            if provider == 'egaSSO':
                # As example, this line request a GET to base_url + '/' + userDetails with Bearer  Authentication,
        # and expects that authorization server checks the token, and response with user details
                me = self.appbuilder.sm.oauth_remotes[provider].get('userDetails').data
                logging.debug("user_data: {0}".format(me))
                return { 'name' : me['name'], 'email' : me['email'], 'id' : me['user_name'], 'username' : me['user_name'], 'first_name':'', 'last_name':''}
        ...

This file must be located at the same directory than ``superset_config.py`` with the name ``custom_sso_security_manager.py``.

Then we can add this two lines to ``superset_config.py``:

.. code-block:: python

  from custom_sso_security_manager import CustomSsoSecurityManager
  CUSTOM_SECURITY_MANAGER = CustomSsoSecurityManager

Feature Flags
-------------

Because of a wide variety of users, Superset has some features that are not enabled by default. For example, some users have stronger security restrictions, while some others may not. So Superset allow users to enable or disable some features by config. For feature owners, you can add optional functionalities in Superset, but will be only affected by a subset of users.

You can enable or disable features with flag from ``superset_config.py``:

.. code-block:: python

     DEFAULT_FEATURE_FLAGS = {
         'CLIENT_CACHE': False,
         'ENABLE_EXPLORE_JSON_CSRF_PROTECTION': False,
         'PRESTO_EXPAND_DATA': False,
     }

Here is a list of flags and descriptions:

* ENABLE_EXPLORE_JSON_CSRF_PROTECTION

  * For some security concerns, you may need to enforce CSRF protection on all query request to explore_json endpoint. In Superset, we use `flask-csrf <https://sjl.bitbucket.io/flask-csrf/>`_ add csrf protection for all POST requests, but this protection doesn't apply to GET method.

  * When ENABLE_EXPLORE_JSON_CSRF_PROTECTION is set to true, your users cannot make GET request to explore_json. The default value for this feature False (current behavior), explore_json accepts both GET and POST request. See `PR 7935 <https://github.com/apache/incubator-superset/pull/7935>`_ for more details.

* PRESTO_EXPAND_DATA

  * When this feature is enabled, nested types in Presto will be expanded into extra columns and/or arrays. This is experimental, and doesn't work with all nested types.


SIP-15
------

`SIP-15 <https://github.com/apache/incubator-superset/issues/6360>`_ aims to ensure that time intervals are handled in a consistent and transparent manner for both the Druid and SQLAlchemy connectors.

Prior to SIP-15 SQLAlchemy used inclusive endpoints however these may behave like exclusive for string columns (due to lexicographical ordering) if no formatting was defined and the column formatting did not conform to an ISO 8601 date-time (refer to the SIP for details).

To remedy this rather than having to define the date/time format for every non-IS0 8601 date-time column, once can define a default column mapping on a per database level via the ``extra`` parameter ::

    {
        "python_date_format_by_column_name": {
            "ds": "%Y-%m-%d"
        }
    }

**New deployments**

All new Superset deployments should enable SIP-15 via,

.. code-block:: python

    SIP_15_ENABLED = True

**Existing deployments**

Given that it is not apparent whether the chart creator was aware of the time range inconsistencies (and adjusted the endpoints accordingly) changing the behavior of all charts is overly aggressive. Instead SIP-15 proivides a soft transistion allowing producers (chart owners) to see the impact of the proposed change and adjust their charts accordingly.

Prior to enabling SIP-15 existing deployments should communicate to their users the impact of the change and define a grace period end date (exclusive of course) after which all charts will conform to the [start, end) interval, i.e.,

.. code-block:: python

    from dateime import date

    SIP_15_ENABLED = True
    SIP_15_GRACE_PERIOD_END = date(<YYYY>, <MM>, <DD>)

To aid with transparency the current endpoint behavior is explicitly called out in the chart time range (post SIP-15 this will be [start, end) for all connectors and databases). One can override the defaults on a per database level via the ``extra``
parameter ::

    {
        "time_range_endpoints": ["inclusive", "inclusive"]
    }


Note in a future release the interim SIP-15 logic will be removed (including the ``time_grain_endpoints`` form-data field) via a code change and Alembic migration.
