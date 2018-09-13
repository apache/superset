# Updating Superset

This file documents any backwards-incompatible changes in Superset and
assists people when migrating to a new version.

## Superset 0.28.0
* Superset 0.28 deprecates the previous dashboard layout. While 0.27
  offered a migration workflow to users and allowed them to validate and
  publish their migrated dashboards individually, 0.28 forces
  the migration of all
  dashboards through an automated db migration script. We
  do recommend that you take a backup prior to this migration.

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
