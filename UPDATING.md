<!--
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements.  See the NOTICE file
distributed with this work for additional information
regarding copyright ownership.  The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License.  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied.  See the License for the
specific language governing permissions and limitations
under the License.
-->
# Updating Superset

This file documents any backwards-incompatible changes in Superset and
assists people when migrating to a new version.

## Next Version

* [7667](https://github.com/apache/incubator-superset/pull/7667): a change to
make all Unix timestamp (which by definition are in UTC) comparisons refer
to a timestamp in UTC as opposed to local time.

* [5451](https://github.com/apache/incubator-superset/pull/5451): a change
which adds missing non-nullable fields to the `datasources` table. Depending on
the integrity of the data, manual intervention may be required.

* [5452](https://github.com/apache/incubator-superset/pull/5452): a change
which adds missing non-nullable fields and uniqueness constraints to the
`columns`and `table_columns` tables. Depending on the integrity of the data,
manual intervention may be required.
* `fabmanager` command line is deprecated since Flask-AppBuilder 2.0.0, use
the new `flask fab <command>` integrated with *Flask cli*.
* `SUPERSET_UPDATE_PERMS` environment variable was replaced by
`FAB_UPDATE_PERMS` config boolean key. To disable automatic
creation of permissions set `FAB_UPDATE_PERMS = False` on config.
* [5453](https://github.com/apache/incubator-superset/pull/5453): a change
which adds missing non-nullable fields and uniqueness constraints to the metrics
and sql_metrics tables. Depending on the integrity of the data, manual
intervention may be required.
* [7616](https://github.com/apache/incubator-superset/pull/7616): this bug fix
changes time_compare deltas to correctly evaluate to the number of days prior
instead of number of days in the future. It will change the data for advanced
analytics time_compare so `1 year` from 5/1/2019 will be calculated as 365 days
instead of 366 days.

## Superset 0.32.0

* `npm run backend-sync` is deprecated and no longer needed, will fail if called
* [5445](https://github.com/apache/incubator-superset/pull/5445): a change
which prevents encoding of empty string from form data in the database.
This involves a non-schema changing migration which does potentially impact
a large number of records. Scheduled downtime may be advised.

## Superset 0.31.0

* If you use `Hive` or `Presto`, we've moved some dependencies that were
  in the main package as optional now. To get these packages,
  run `pip install superset[presto]` and/or `pip install superset[hive]` as
  required.

* Similarly, if you use Celery's `flower`, `gsheetsdb`, `thrift` or
  `thrift-sasl`, those dependencies have now been made optional in our
  package, meaning you may have to install them in your environment post
  0.31.0

* boto3 / botocore was removed from the dependency list. If you use s3
as a place to store your SQL Lab result set or Hive uploads, you may
have to rely on an alternate requirements.txt file to install those
dependencies.
* From 0.31.0 onwards, we recommend not using the npm package `yarn` in
favor of good old `npm install`. While yarn should still work just fine,
you should probably align to guarantee builds similar to the ones we
use in testing and across the community in general.

## Superset 0.30.0
* 0.30.0 includes a db_migration that removes allow_run_sync. This may
require downtime because during the migration if the db is migrated first,
superset will get 500 errors when the code can't find the field (until
the deploy finishes).

## Superset 0.29.0
* India was removed from the "Country Map" visualization as the geojson
  file included in the package was very large

## Superset 0.28.0
* Support for Python 2 is deprecated, we only support >=3.6 from
  `0.28.0` onwards

* Superset 0.28 deprecates the previous dashboard layout. While 0.27
  offered a migration workflow to users and allowed them to validate and
  publish their migrated dashboards individually, 0.28 forces
  the migration of all
  dashboards through an automated db migration script. We
  do recommend that you take a backup prior to this migration.

* Superset 0.28 deprecates the `median` cluster label aggregator for mapbox visualizations. This particular aggregation is not supported on mapbox visualizations going forward.

* Superset 0.28 upgrades `flask-login` to `>=0.3`, which includes a
    backwards-incompatible change: `g.user.is_authenticated`,
    `g.user.is_anonymous`, and `g.user.is_active` are now properties
    instead of methods.

## Superset 0.27.0
* Superset 0.27 start to use nested layout for dashboard builder, which is not
backward-compatible with earlier dashboard grid data. We provide migration script
to automatically convert dashboard grid to nested layout data. To be safe, please
take a database backup prior to this upgrade. It's the only way people could go
back to a previous state.


## Superset 0.26.0
* Superset 0.26.0 deprecates the `superset worker` CLI, which is a simple
wrapper around the `celery worker` command, forcing you into crafting
your own native `celery worker` command. Your command should look something
like `celery worker --app=superset.sql_lab:celery_app --pool=gevent -Ofair`

## Superset 0.25.0
Superset 0.25.0 contains a backwards incompatible changes.
If you run a production system you should schedule downtime for this
upgrade.

The PRs bellow have more information around the breaking changes:
* [4587](https://github.com/apache/incubator-superset/pull/4587) : a backward
  incompatible database migration that requires downtime. Once the
  db migration succeeds, the web server needs to be restarted with the
  new version. The previous version will fail
* [4565](https://github.com/apache/incubator-superset/pull/4565) : we've
  changed the security model a bit where in the past you would have to
  define your authentication scheme by inheriting from Flask
  App Builder's
  `from flask_appbuilder.security.sqla.manager import SecurityManager`,
  you now have to derive Superset's
  own derivative `superset.security.SupersetSecurityManager`. This
  can provide you with more hooks to define your own logic and/or defer
  permissions to another system as needed. For all implementation, you
  simply have to import and derive `SupersetSecurityManager` in place
  of the `SecurityManager`
* [4835](https://github.com/apache/incubator-superset/pull/4835) :
  our `setup.py` now only pins versions where required, giving you
  more latitude in using versions of libraries as needed. We do now
  provide a `requirements.txt` with pinned versions if you want to run
  the suggested versions that `Superset` builds and runs tests against.
  Simply `pip install -r requirements.txt` in your build pipeline, likely
  prior to `pip install superset==0.25.0`
