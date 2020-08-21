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

.. |apache_img| image:: _static/images/apache_feather.png
   :width: 7%
   :target: http://www.apache.org/
   :alt: The Apache Software Foundation

.. |superset_img| image:: _static/images/s.png
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
- Versioned versions of this documentation: https://readthedocs.org/projects/apache-superset/
- `Superset's Github <https://github.com/apache/incubator-superset>`_, note
  that `we use Github for issue tracking <https://github.com/apache/incubator-superset/issues>`_
- Superset's
  `contribution guidelines <https://github.com/apache/incubator-superset/blob/master/CONTRIBUTING.md>`_
  and
  `code of conduct <https://github.com/apache/incubator-superset/blob/master/CODE_OF_CONDUCT.md>`_
  on Github. (You can contribute to this documentation `here <https://github.com/apache/incubator-superset/tree/master/docs>`_)
- Our `mailing list archives <https://lists.apache.org/list.html?dev@superset.apache.org>`_.
  To subscribe, send an email to ``dev-subscribe@superset.apache.org``
- `Superset Users <https://github.com/apache/incubator-superset/blob/master/INTHEWILD.md>`_
- `Join our commmunity Slack channel <https://join.slack.com/t/apache-superset/shared_invite/zt-g8lpruog-HeqpgYrwdfrD5OYhlU7hPQ>`_
- `Awesome Apache Superset <https://github.com/apache-superset/awesome-apache-superset>`_ collection of learning resources from around the Internet.
- `StackOverflow Q&A <https://stackoverflow.com/questions/tagged/apache-superset>`_
- `Community Meetup Recordings <https://www.youtube.com/channel/UCMuwrvBsg_jjI2gLcm04R0g>`_

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

- An intuitive interface to explore and visualize datasets, and create interactive dashboards.
- A wide array of beautiful visualizations to showcase your data.
- Easy, code-free, user flows to drill down and slice and dice the data underlying exposed dashboards. The dashboards and charts act as a starting point for deeper analysis.
- A state of the art SQL editor/IDE exposing a rich metadata browser, and an easy workflow to create visualizations out of any result set.
- An extensible, high granularity security model allowing intricate rules on who can access which product features and datasets. Integration with major authentication backends (database, OpenID, LDAP, OAuth, REMOTE_USER, ...)
- A lightweight semantic layer, allowing to control how data sources are exposed to the user by defining dimensions and metrics
- Out of the box support for most SQL-speaking databases
- Deep integration with Druid allows for Superset to stay blazing fast while slicing and dicing large, realtime datasets
- Fast loading dashboards with configurable caching


Databases
---------

The following RDBMS are currently supported:

- `Amazon Athena </installation.html#aws-athena>`_
- `Amazon Redshift </installation.html#database-dependencies>`_
- `Apache Drill </installation.html#apache-drill>`_
- `Apache Druid </installation.html#druid>`_
- `Apache Hive </installation.html#database-dependencies>`_
- `Apache Impala </installation.html#database-dependencies>`_
- `Apache Kylin </installation.html#database-dependencies>`_
- `Apache Pinot </installation.html#database-dependencies/>`_
- `Apache Spark SQL </installation.html#database-dependencies>`_
- `BigQuery </installation.html#google-bigquery>`_
- `ClickHouse </installation.html#database-dependencies>`_
- `CockroachDB </installation.html#database-dependencies>`_
- `Dremio </installation.html#dremio>`_
- `Elasticsearch </installation.html#elasticsearch>`_
- `Exasol </installation.html#exasol>`_
- `Google Sheets </installation.html#database-dependencies>`_
- `Greenplum </installation.html#database-dependencies>`_
- `IBM Db2 </installation.html#database-dependencies>`_
- `MySQL </installation.html#database-dependencies>`_
- `Oracle </installation.html#database-dependencies>`_
- `PostgreSQL </installation.html#postgresql>`_
- `Presto </installation.html#presto>`_
- `Snowflake </installation.html#snowflake>`_
- `SQLite </installation.html#database-dependencies>`_
- `SQL Server </installation.html#database-dependencies>`_
- `Teradata </installation.html#teradata>`_
- `Vertica </installation.html#database-dependencies>`_
- `Hana </installation.html#hana>`_

Other database engines with a proper DB-API driver and SQLAlchemy dialect should
be supported as well.

Screenshots
-----------

.. image:: _static/images/screenshots/bank_dash.png

------

.. image:: _static/images/screenshots/explore.png

------

.. image:: _static/images/screenshots/sqllab.png

------

.. image:: _static/images/screenshots/deckgl_dash.png

------


Contents
--------

.. toctree::
    :maxdepth: 2

    installation
    tutorials
    security
    sqllab
    gallery
    druid
    misc
    issue_code_reference
    faq


Indices and tables
------------------

* :ref:`genindex`
* :ref:`modindex`
* :ref:`search`
