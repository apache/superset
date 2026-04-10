# Camino Superset

This is a Superset config for Camino.

## Docker & Compose Settings

> Note that docker/.env sets the default environment variables for all the docker images used by docker compose, and that docker/.env-local can be used to override those defaults. Also note that docker/.env-local is referenced in our .gitignore, preventing developers from risking committing potentially sensitive configuration to the repository.

via [docs](https://superset.apache.org/docs/installation/docker-compose)

## Environment Variables

You **must** copy `docker/.env.example` to `docker/.env`

```bash
cp docker/.env.example docker/.env
```

Then make local edits to `docker/.env-local` file which overrides values from `docker/.env`.

For example, create a _docker/.env-local_ file with the following keys:
```
# Must be lowercase with only alphanumeric characters, hyphens, and underscores
COMPOSE_PROJECT_NAME=radix-hub

# Provide the name of the host machine (also HOSTNAME)
HOST_NAME=<GAEXX>

# Set this to a unique secure random value on production
DATABASE_PASSWORD=superset

SUPERSET_LOAD_EXAMPLES=no

# Make sure you set this to a unique secure random value on production
# using something like `openssl rand -base64 42`
SUPERSET_SECRET_KEY=TEST_NON_DEV_SECRET

# Specify the Superset image tag to use
TAG=6.0.0
```

## Start up and shut down Superset

The following shell scripts call docker compose with the docker-compose-camino.yml file.

```bash
./up.sh
```

```bash
./down.sh
```

