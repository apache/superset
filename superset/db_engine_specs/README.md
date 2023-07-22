Database engine specifications
==============================

Superset uses [SQLAlchemy](https://www.sqlalchemy.org/) as an abstraction layer for running queries and fetching metadata from tables (like column names and types). Unfortunately, while SQLAlchemy offers enough functionality to allow connecting Superset to dozens of databases, there are still implementation details that differ across them. Because of this, Superset has an additional abstraction on top of SQLAlchemy, called a "database engine specification" or, simply, "DB engine spec".

DB engine specs were created initially because there's no SQL standard for computing aggregations at different time grains. For example, to compute a daily metric in Trino or Postgres we would run a query like this:

```sql
SELECT
  date_trunc('day', CAST(time_column) AS TIMESTAMP) AS day,
  COUNT(*) AS metric
FROM
  some_table
GROUP BY
  1
```

For MySQL, instead of using the `date_trunc` function, we would need to write:

```sql
SELECT
  DATE(time_column) AS day,
  COUNT(*) AS metric
FROM
  some_table
GROUP BY
  1
```

Over time, more and more functionality was added to DB engine specs, including validating SQL, estimating the cost of queries before they are run, and understanding the semantics of error messages. These are all described in detail in this document, and in the table below you can see a summary of what features are supported by each database.

Note that DB engine specs are completely optional. Superset can connect to any database supported by SQLAlchemy (or 3rd party dialects) even if there's no DB engine spec associated with it. But DB engine specs greatly improve the experience of working with a database in Superset.



