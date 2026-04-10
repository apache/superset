# Camino Superset

This is a Superset config for Camino.

## Deployment

### Docker & Compose Settings

> `docker/.env` sets the default environment variables for all the docker images used by docker compose - this file should **not** be modified.
> Instead, `docker/.env-local` can be used to override those defaults.
> Also note that `docker/.env-local` had been added to the `.gitignore`, whereas `docker/.env` is tracked by git.

See the Superset [docs for Docker Compose](https://superset.apache.org/docs/installation/docker-compose) for more details.

### Environment Variables

Create the `docker/.env-local` file:

```bash
touch docker/.env-local
```

You will need to set the following environment variables:

```bash
# Must be lowercase with only alphanumeric characters, hyphens, and underscores
COMPOSE_PROJECT_NAME=camino

# HOST_NAME & HOSTNAME is the name of the GAE host machine
HOST_NAME=uclvlddpragaeXX
HOSTNAME=uclvlddpragaeXX

# Set this to a unique secure random value on production
# DATABASE_PASSWORD=superset

SUPERSET_LOAD_EXAMPLES=no
SUPERSET_ENV=production
DEV_MODE=false
SUPERSET_LOG_LEVEL=debug

# Make sure you set this to a unique secure random value on production
# using something like `openssl rand -base64 42`
SUPERSET_SECRET_KEY=THIS_IS_VERY_SECURE

# Specify the Superset image tag to use
TAG=6.0.0

PYTHONPATH=/app/pythonpath:/app/docker/pythonpath_dev

# Parameters for connecting to the Camino DuckLake
DUCKLAKE_DB_USER=<username>
DUCKLAKE_DB_PASSWORD=<passowrd>
DUCKLAKE_DB_NAME=<db name>
DUCKLAKE_POSTGRES_HOST=host.docker.internal
DUCKLAKE_POSTGRES_PORT=<exposed port>
```

### Start up and shut down Superset

To start Superset:

```bash
./up.sh
```

Superset will then be available at `<HOST_NAME>::8088` (or `http://<HOST_NAME>:8088` if you set the `HOST_NAME` variable).

```bash
./down.sh
```

## Creating a connection to the Camino DuckLake

To connect to the Camino DuckLake, you will need to connect to a DuckDB database in Superset. You will need to ensure the DuckDB
database file exists before you try to connect to it from Superset. It can be an empty file, e.g.:

```python
import duckdb
con = duckdb.connect('/var/data/duckdb/my_duck.db')
con.close()
```

Then, in the Superset UI, go to `Settings` -> `Database Connections` -> `+ Database Connection` to view existing connections.
Add a new connection, and use the following settings:

1. Select a database to connect: Supported Databases -> DuckDB
2. Enter the required DuckDB credentials: Use a SQLALchemy URI string in the format `duckdb:////var/data/duckdb/my_duck.db` (note the 4 slashes after `duckdb:`)
3. Click `Test Connection` to ensure the connection is successful, then click `Connect` to save the connection.

When connecting to a DuckDB database, the Camino DuckLake will automatically be attached to it. You should see the `camino.bronze`,
`camino.silver` and `camino.gold` schemas are available in the database. This automatic attached is handled in the
[Python config for Camino Superset](./docker/pythonpath_dev/superset_config_docker.py).

## Updating Superset

To update the Superset version, you will need to:

- backup the Superset metadata database:

```bash
docker compose exec superset_db pg_dump -U superset -d superset > superset_backup.sql
```

- pull the latest changes from the upstream repo. This can be done from the GitHub UI by clicking 'Sync upstream' from the main page of this fork.
- update `TAG` variable in the `docker/.env-local` file to the desired version
- perform any other changes required, as described in the [Superset release notes](./UPDATING.md).
- deploy the updated Superset:

> It is **highly recommended** to confirm a fresh instance of Superset can be deployed before updating the production instance.

You will need to shutdown the Superset instance and delete the volumes:

```bash
docker compose -f docker-compose-down.yml down --remove-orphans
```

This will not delete any user data, only metadata we have backed up.

Then deploy Superset again with the new version:

```bash
./up.sh
```

If you have updated to a new major version, you will need to clear the new schema before importing the metadata backup:

```bash
docker exec -it superset_db psql -U superset -d superset -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
```

Now you can import the metadata backup:

```bash
cat superset_backup.sql | docker exec -i superset_db psql -U superset -d superset
```

Finally, migrate and then initialise Superset:

```bash
docker exec -it superset_app superset db upgrade
docker exec -it superset_app superset init
```

## Notes

- See the details here for tag specification: https://superset.apache.org/docs/installation/docker-builds
  - e.g 6.0.0 is lean ... 250MB ish, 6.0.0-dev is not! (but includes postgres drivers and more) ... 1GB
- You may get warnings during initiaton about flask migrations. 

```bash
superset_init         | ERROR [flask_migrate] Error: Can't locate revision identified by '74ad1125881c'
```

These can probably be ignored but you can always delete the `radix-hub_db_data` volume if you want to be sure.

```bash
docker compose down
docker volume rm radix-hub_db_data
```
