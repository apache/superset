---
title: Extra Database Settings
hide_title: true
sidebar_position: 40
version: 1
---

## Extra Database Settings

### Deeper SQLAlchemy Integration

It is possible to tweak the database connection information using the parameters exposed by
SQLAlchemy. In the **Database edit** view, you can edit the **Extra** field as a JSON blob.

This JSON string contains extra configuration elements. The `engine_params` object gets unpacked
into the `sqlalchemy.create_engine` call, while the `metadata_params` get unpacked into the
`sqlalchemy.MetaData` call. Refer to the SQLAlchemy docs for more information.

### Schemas

Databases like Postgres and Redshift use the **schema** as the logical entity on top of the
**database**. For Superset to connect to a specific schema, you can set the **schema** parameter in
the **Edit Tables** form (Sources > Tables > Edit record).

### External Password Store for SQLAlchemy Connections

Superset can be configured to use an external store for database passwords. This is useful if you a
running a custom secret distribution framework and do not wish to store secrets in Superset’s meta
database.

Example: Write a function that takes a single argument of type `sqla.engine.url` and returns the
password for the given connection string. Then set `SQLALCHEMY_CUSTOM_PASSWORD_STORE` in your config
file to point to that function.

```python
def example_lookup_password(url):
    secret = <<get password from external framework>>
    return 'secret'

SQLALCHEMY_CUSTOM_PASSWORD_STORE = example_lookup_password
```

A common pattern is to use environment variables to make secrets available.
`SQLALCHEMY_CUSTOM_PASSWORD_STORE` can also be used for that purpose.

```python
def example_password_as_env_var(url):
# assuming the uri looks like
# mysql://localhost?superset_user:{SUPERSET_PASSWORD}
return url.password.format(os.environ)

SQLALCHEMY_CUSTOM_PASSWORD_STORE = example_password_as_env_var
```

### SSL Access to Databases

You can use the `Extra` field in the **Edit Databases** form to configure SSL:

```JSON
{
    "metadata_params": {},
    "engine_params": {
          "connect_args":{
              "sslmode":"require",
              "sslrootcert": "/path/to/my/pem"
        }
     }
}
```
