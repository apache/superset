## Python dependency logic

In this folder, the `.in` files, in conjunction with the `../pyproject.toml` file (in the root of the repo) are used to generate the pinned requirements as `.txt` files.

To alter the pinned dependency, you can edit/alter the `.in` and `pyproject.toml` files, and then run the following command:

```bash
./scripts/uv-pip-compile.sh
```
:::warning
The pinned dependencies are based on the `current` version of python supported in Superset.
Output of `./scripts/uv-pip-compile.sh` may vary slightly based on the python version you are using to run the command.
Check the `pyproject.toml` file for the current version of python supported.
:::

This will generate the pinned requirements in the `.txt` files, which will be used in our CI/CD pipelines and in the Docker images.

We recommend to everyone in the community to use the pinned requirements in their local development environments, to ensure consistency across different environments, though we don't force requirements as part of our python package semantics to allow flexibility for users to install different versions of the dependencies if they wish.

Note that `development.txt` is a superset of what's in `base.txt`, and all version numbers for shared library should fully match at all times. `translations.txt` is meant as a supplemental file to be used in conjunction with the other requirements files, and is not meant to be used standalone.

## Temporary SQLAlchemy 1.4 compatibility lane

The generated `base.txt` and `development.txt` files remain the normal OSS
environment and resolve SQLAlchemy 2.x with Flask-SQLAlchemy 3.1.1. A downstream
that temporarily needs SQLAlchemy 1.4 must constrain **both** packages using
`requirements/sqlalchemy14.txt` (SQLAlchemy 1.4.54 and Flask-SQLAlchemy 2.5.1).
Constraining SQLAlchemy alone is intentionally unsupported because
Flask-SQLAlchemy 3.1 requires SQLAlchemy 2.

Python package metadata cannot express correlated alternatives such as “A 1.4
with B 2.5, or A 2.x with B 3.1.” The published bounds therefore describe the
union needed for downstream constraint files; they do not make arbitrary
cross-pair combinations supported. CI tests the two exact pairs, and the OSS
lock files prevent a default install from selecting the legacy pair.

The core package and these commonly tested extras are compatible with both
lanes: `bigquery`, `druid`, `duckdb`, `fastmcp`, `gevent`, `gsheets`, `mysql`,
`postgres`, `presto`, `prophet`, `trino`, and `thumbnails`. The selected driver
lines for `dremio`, `exasol`, `firebird`, `redshift`, and `risingwave` require
SQLAlchemy 2 and must not be installed in the legacy lane. Other extras are not
covered by the legacy CI lane and should be validated by downstream users.

This lane is a temporary bridge for downstream migration, not a change to the
OSS default. Remove the constraints, widened lower bounds, compatibility code,
and legacy CI job together once those downstreams have moved to SQLAlchemy 2.
