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

.. image:: _static/images/screenshots/sqllab.png

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

.. autofunction:: superset.jinja_context.ExtraCache.current_user_id

.. autofunction:: superset.jinja_context.ExtraCache.current_username

.. autofunction:: superset.jinja_context.ExtraCache.url_param

.. autofunction:: superset.jinja_context.filter_values

.. autofunction:: superset.jinja_context.ExtraCache.cache_key_wrapper

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

Customize templating
''''''''''''''''''''

As mentioned in the `Installation & Configuration <https://superset.incubator.apache.org/installation.html#sql-lab>`__ documentation,
it's possible for administrators to overwrite Jinja templating with your customized
template processor using the configuration variable ``CUSTOM_TEMPLATE_PROCESSORS``.
The template processors referenced in the dictionary will overwrite default Jinja template processors
of the specified database engines.

Query cost estimation
'''''''''''''''''''''

Some databases support ``EXPLAIN`` queries that allow users to estimate the cost
of queries before executing this. Currently, Presto is supported in SQL Lab. To
enable query cost estimation, add the following keys to the "Extra" field in the
database configuration:

.. code-block:: text

    {
        "version": "0.319",
        "cost_estimate_enabled": true
        ...
    }

Here, "version" should be the version of your Presto cluster. Support for this
functionality was introduced in Presto 0.319.

You also need to enable the feature flag in your `superset_config.py`, and you
can optionally specify a custom formatter. Eg:

.. code-block:: python

    def presto_query_cost_formatter(cost_estimate: List[Dict[str, float]]) -> List[Dict[str, str]]:
        """
        Format cost estimate returned by Presto.

        :param cost_estimate: JSON estimate from Presto
        :return: Human readable cost estimate
        """
        # Convert cost to dollars based on CPU and network cost. These coefficients are just
        # examples, they need to be estimated based on your infrastructure.
        cpu_coefficient = 2e-12
        network_coefficient = 1e-12

        cost = 0
        for row in cost_estimate:
            cost += row.get("cpuCost", 0) * cpu_coefficient
            cost += row.get("networkCost", 0) * network_coefficient

        return [{"Cost": f"US$ {cost:.2f}"}]


    DEFAULT_FEATURE_FLAGS = {
        "ESTIMATE_QUERY_COST": True,
        "QUERY_COST_FORMATTERS_BY_ENGINE": {"presto": presto_query_cost_formatter},
    }

.. _ref_ctas_engine_config:

Create Table As (CTAS)
''''''''''''''''''''''

You can use ``CREATE TABLE AS SELECT ...`` statements on SQLLab. This feature can be toggled on
and off at the database configuration level.

Note that since ``CREATE TABLE..`` belongs to a SQL DDL category. Specifically on PostgreSQL, DDL is transactional,
this means that to properly use this feature you have to set ``autocommit`` to true on your engine parameters:

.. code-block:: text

    {
        ...
        "engine_params": {"isolation_level":"AUTOCOMMIT"},
        ...
    }
