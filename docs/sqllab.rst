SQL Lab
=======

SQL Lab is a modern, feature-rich SQL IDE written in React.


Feature Overview
----------------
- Connects to just about any database backend
- A multi-tab environment to work on multiple queries at a time
- A smooth flow to visualize your query results using Caravel's rich
  visualization capabilities
- Browse database metadata: tables, columns, indexes, partitions
- Support for long-running queries
  - uses the Celery async framework to dispatch query handling to workers
  - supports defining a "result backend" to persist query results
- A search engine to find queries executed in the past
- Supports templating using the ``jinja`` templating language,
  which allows for using macros in your SQL code


Templating with Jinja
---------------------

.code ::

    SELECT *
    FROM some_table
    WHERE partition_key = '{{ hive.latest_partition('some_table') }}'

Templating allows for getting the power and capabilities of a
programming language inside your SQL.

It also enables for writing generic queries as templates that can be
parameterized and re-used more flexibly.
