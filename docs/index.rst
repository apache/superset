.. image:: images/s.png

Apache Superset (incubating)
''''''''''''''''''''''''''''

Apache Superset (incubating) is a modern, enterprise-ready business
intelligence web application


----------------

.. warning:: This project was originally named Panoramix, was renamed to
    Caravel in March 2016, and is currently named Superset as of November 2016

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

