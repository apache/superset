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

|apache_img| |superset_img|

.. |apache_img| image:: images/apache_feather.png
   :width: 7%
   :target: http://www.apache.org/
   :alt: The Apache Software Foundation

.. |superset_img| image:: images/s.png
   :width: 25%

Apache Superset (incubating)
''''''''''''''''''''''''''''

Apache Superset (incubating) is a modern, enterprise-ready business
intelligence web application


----------------

.. important::

    **Disclaimer**: Apache Superset is an effort undergoing incubation at The
    Apache Software Foundation (ASF), sponsored by the Apache Incubator.
    Incubation is required of all newly accepted projects until a further
    review indicates that the infrastructure, communications, and
    decision making process have stabilized in a manner consistent with
    other successful ASF projects. While incubation status is not
    necessarily a reflection of the completeness or stability of
    the code, it does indicate that the project has yet to be fully
    endorsed by the ASF.

.. note:: Apache Superset, Superset, Apache, the Apache feather logo, and
    the Apache Superset project logo are either registered trademarks or
    trademarks of The Apache Software Foundation in the United States
    and other countries.

Superset Resources
==================
- `Superset's Github <https://github.com/apache/incubator-superset>`_, note
  that `we use Github for issue tracking <https://github.com/apache/incubator-superset/issues>`_
- Superset's
  `contribution guidelines <https://github.com/apache/incubator-superset/blob/master/CONTRIBUTING.md>`_
  and
  `code of conduct <https://github.com/apache/incubator-superset/blob/master/CODE_OF_CONDUCT.md>`_
  on Github.
- Our `mailing list archives <https://lists.apache.org/list.html?dev@superset.apache.org>`_.
  To subscribe, send an email to ``dev-subscribe@superset.apache.org``
- `Join our Slack <https://join.slack.com/t/apache-superset/shared_invite/enQtNDMxMDY5NjM4MDU0LWJmOTcxYjlhZTRhYmEyYTMzOWYxOWEwMjcwZDZiNWRiNDY2NDUwNzcwMDFhNzE1ZmMxZTZlZWY0ZTQ2MzMyNTU>`_

Apache Software Foundation Resources
====================================
- `The Apache Software Foundation Website <http://www.apache.org>`_
- `Current Events <http://www.apache.org/events/current-event>`_
- `License <https://www.apache.org/licenses/>`_
- `Thanks <https://www.apache.org/foundation/thanks.html>`_ to the ASF's sponsors
- `Sponsor Apache! <http://www.apache.org/foundation/sponsorship.html>`_

Overview
========

Features
--------

- A rich set of data visualizations
- An easy-to-use interface for exploring and visualizing data
- Create and share dashboards
- Enterprise-ready authentication with integration with major authentication
  providers (database, OpenID, LDAP, OAuth & REMOTE_USER through
  Flask AppBuilder)
- An extensible, high-granularity security/permission model allowing
  intricate rules on who can access individual features and the dataset
- A simple semantic layer, allowing users to control how data sources are
  displayed in the UI by defining which fields should show up in which
  drop-down and which aggregation and function metrics are made available
  to the user
- Integration with most SQL-speaking RDBMS through SQLAlchemy
- Deep integration with Druid.io

Databases
---------

The following RDBMS are currently supported:

- `Amazon Athena <https://aws.amazon.com/athena/>`_
- `Amazon Redshift <https://aws.amazon.com/redshift/>`_
- `Apache Drill <https://drill.apache.org/>`_
- `Apache Druid <http://druid.io/>`_
- `Apache Hive <https://hive.apache.org/>`_
- `Apache Impala <https://impala.apache.org/>`_
- `Apache Kylin <http://kylin.apache.org/>`_
- `Apache Pinot <https://pinot.incubator.apache.org/>`_
- `Apache Spark SQL <https://spark.apache.org/sql/>`_
- `BigQuery <https://cloud.google.com/bigquery/>`_
- `ClickHouse <https://clickhouse.yandex/>`_
- `Exasol <https://www.exasol.com/>`_
- `Google Sheets <https://www.google.com/sheets/about/>`_
- `Greenplum <https://greenplum.org/>`_
- `IBM Db2 <https://www.ibm.com/analytics/db2/>`_
- `MySQL <https://www.mysql.com/>`_
- `Oracle <https://www.oracle.com/database/>`_
- `PostgreSQL <https://www.postgresql.org/>`_
- `Presto <http://prestodb.github.io/>`_
- `Snowflake <https://www.snowflake.com/>`_
- `SQLite <https://www.sqlite.org/>`_
- `SQL Server <https://www.microsoft.com/en-us/sql-server/>`_
- `Teradata <https://www.teradata.com/>`_
- `Vertica <https://www.vertica.com/>`_

Other database engines with a proper DB-API driver and SQLAlchemy dialect should
be supported as well.

Screenshots
-----------

.. image:: images/screenshots/bank_dash.png

------

.. image:: images/screenshots/explore.png

------

.. image:: images/screenshots/sqllab.png

------

.. image:: images/screenshots/deckgl_dash.png

------


Contents
--------

.. toctree::
    :maxdepth: 2

    installation
    tutorial
    security
    sqllab
    gallery
    druid
    misc
    faq


Indices and tables
------------------

* :ref:`genindex`
* :ref:`modindex`
* :ref:`search`
