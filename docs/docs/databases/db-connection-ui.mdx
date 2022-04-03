---
title: Using Database Connection UI
hide_title: true
sidebar_position: 3
version: 1
---

Here is the documentation on how to leverage the new DB Connection UI. This will provide admins the ability to enhance the UX for users who want to connect to new databases.

![db-conn-docs](https://user-images.githubusercontent.com/27827808/125499607-94e300aa-1c0f-4c60-b199-3f9de41060a3.gif)

There are now 3 steps when connecting to a database in the new UI:

Step 1: First the admin must inform superset what engine they want to connect to. This page is powered by the `/available` endpoint which pulls on the engines currently installed in your environment, so that only supported databases are shown.

Step 2: Next, the admin is prompted to enter database specific parameters. Depending on whether there is a dynamic form available for that specific engine, the admin will either see the new custom form or the legacy SQLAlchemy form. We currently have built dynamic forms for (Redshift, MySQL, Postgres, and BigQuery). The new form prompts the user for the parameters needed to connect (for example, username, password, host, port, etc.) and provides immediate feedback on errors.

Step 3: Finally, once the admin has connected to their DB using the dynamic form they have the opportunity to update any optional advanced settings.

We hope this feature will help eliminate a huge bottleneck for users to get into the application and start crafting datasets.

### How to setup up preferred database options and images

We added a new configuration option where the admin can define their preferred databases, in order:

```python
# A list of preferred databases, in order. These databases will be
# displayed prominently in the "Add Database" dialog. You should
# use the "engine_name" attribute of the corresponding DB engine spec
# in `superset/db_engine_specs/`.
PREFERRED_DATABASES: List[str] = [
    "PostgreSQL",
    "Presto",
    "MySQL",
    "SQLite",
]
```

For copyright reasons the logos for each database are not distributed with Superset.

### Setting images

- To set the images of your preferred database, admins must create a mapping in the `superset_text.yml` file with engine and location of the image. The image can be host locally inside your static/file directory or online (e.g. S3)

```python
DB_IMAGES:
  postgresql: "path/to/image/postgres.jpg"
  bigquery: "path/to/s3bucket/bigquery.jpg"
  snowflake: "path/to/image/snowflake.jpg"
```

### How to add new database engines to available endpoint

Currently the new modal supports the following databases:

- Postgres
- Redshift
- MySQL
- BigQuery

When the user selects a database not in this list they will see the old dialog asking for the SQLAlchemy URI. New databases can be added gradually to the new flow. In order to support the rich configuration a DB engine spec needs to have the following attributes:

1. `parameters_schema`: a Marshmallow schema defining the parameters needed to configure the database. For Postgres this includes username, password, host, port, etc. ([see](https://github.com/apache/superset/blob/accee507c0819cd0d7bcfb5a3e1199bc81eeebf2/superset/db_engine_specs/base.py#L1309-L1320)).
2. `default_driver`: the name of the recommended driver for the DB engine spec. Many SQLAlchemy dialects support multiple drivers, but usually one is the official recommendation. For Postgres we use "psycopg2".
3. `sqlalchemy_uri_placeholder`: a string that helps the user in case they want to type the URI directly.
4. `encryption_parameters`: parameters used to build the URI when the user opts for an encrypted connection. For Postgres this is `{"sslmode": "require"}`.

In addition, the DB engine spec must implement these class methods:

- `build_sqlalchemy_uri(cls, parameters, encrypted_extra)`: this method receives the distinct parameters and builds the URI from them.
- `get_parameters_from_uri(cls, uri, encrypted_extra)`: this method does the opposite, extracting the parameters from a given URI.
- `validate_parameters(cls, parameters)`: this method is used for `onBlur` validation of the form. It should return a list of `SupersetError` indicating which parameters are missing, and which parameters are definitely incorrect ([example](https://github.com/apache/superset/blob/accee507c0819cd0d7bcfb5a3e1199bc81eeebf2/superset/db_engine_specs/base.py#L1404)).

For databases like MySQL and Postgres that use the standard format of `engine+driver://user:password@host:port/dbname` all you need to do is add the `BasicParametersMixin` to the DB engine spec, and then define the parameters 2-4 (`parameters_schema` is already present in the mixin).

For other databases you need to implement these methods yourself. The BigQuery DB engine spec is a good example of how to do that.
