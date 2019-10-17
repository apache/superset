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

SQL Lab
=======

SQL Lab is a modern, feature-rich SQL IDE written in
`React <https://facebook.github.io/react/>`_.

------

.. image:: images/screenshots/sqllab.png

------

Feature Overview
----------------
- Connects to just about any database backend
- A multi-tab environment to work on multiple queries at a time
- A smooth flow to visualize your query results using Superset's rich
  visualization capabilities
- Browse database metadata: tables, columns, indexes, partitions
- Support for long-running queries

  - uses the `Celery distributed queue <http://www.celeryproject.org/>`_
    to dispatch query handling to workers
  - supports defining a "results backend" to persist query results

- A search engine to find queries executed in the past
- Supports templating using the
  `Jinja templating language <http://jinja.pocoo.org/docs/dev/>`_
  which allows for using macros in your SQL code

Extra features
--------------
- Hit ``alt + enter`` as a keyboard shortcut to run your query

Templating with Jinja
---------------------

.. code-block:: sql

    SELECT *
    FROM some_table
    WHERE partition_key = '{{ presto.first_latest_partition('some_table') }}'

Templating unleashes the power and capabilities of a
programming language within your SQL code.

Templates can also be used to write generic queries that are
parameterized so they can be re-used easily.


Available macros
''''''''''''''''

We expose certain modules from Python's standard library in
Superset's Jinja context:

- ``time``: ``time``
- ``datetime``: ``datetime.datetime``
- ``uuid``: ``uuid``
- ``random``: ``random``
- ``relativedelta``: ``dateutil.relativedelta.relativedelta``

`Jinja's builtin filters <http://jinja.pocoo.org/docs/dev/templates/>`_ can be also be applied where needed.

.. autofunction:: superset.jinja_context.current_user_id

.. autofunction:: superset.jinja_context.current_username

.. autofunction:: superset.jinja_context.url_param

.. autofunction:: superset.jinja_context.filter_values

.. autofunction:: superset.jinja_context.CacheKeyWrapper.cache_key_wrapper

.. autoclass:: superset.jinja_context.PrestoTemplateProcessor
    :members:

.. autoclass:: superset.jinja_context.HiveTemplateProcessor
    :members:

Extending macros
''''''''''''''''

As mentioned in the `Installation & Configuration <https://superset.incubator.apache.org/installation.html#installation-configuration>`_ documentation,
it's possible for administrators to expose more more macros in their
environment using the configuration variable ``JINJA_CONTEXT_ADDONS``.
All objects referenced in this dictionary will become available for users
to integrate in their queries in **SQL Lab**.

Query cost estimation
'''''''''''''''''''''

Some databases support ``EXPLAIN`` queries that allow users to estimate the cost
of queries before executing this. Currently, Presto is supported in SQL Lab. To
enable query cost estimation, add the following keys to the "Extra" field in the
database configuration:

.. code-block:: json

    {
        "version": "0.319",
        "cost_estimate_enabled": true,
        ...
    }

Here, "version" should be the version of your Presto cluster. Support for this
functionality was introduced in Presto 0.319.

.. _ref_ctas_engine_config:

Create Table As (CTAS)
''''''''''''''''''''''

You can use ``CREATE TABLE AS SELECT ...`` statements on SQLLab. This feature can be toggled on
and off at the database configuration level.

Note that since ``CREATE TABLE..`` belongs to a SQL DDL category. Specifically on PostgreSQL, DDL is transactional,
this means that to properly use this feature you have to set ``autocommit`` to true on your engine parameters:

.. code-block:: json

    {
        ...
        "engine_params": {"isolation_level":"AUTOCOMMIT"},
        ...
    }
