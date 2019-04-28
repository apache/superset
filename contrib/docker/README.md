# Getting Start with Superset using Docker

Docker is the recommended way to get stated with Superset.

## Initializing Database

To initialize the database with a user and example charts, dashboards and datasets run:

```bash
SUPERSET_LOAD_EXAMPLES=yes docker-compose run --rm superset ./docker-init.sh
```

This may take a minute.

## Normal Operation

To run the container, simply run:

```bash
docker-compose up
```

After several minutes for superset initialization to finish, you can open a browser and view [`http://localhost:8088`](http://localhost:8088) 
to start your journey.

## Developing

While running, the container server will reload on modification of the superset python and javascript source code.
Don't forget to reload the page to take the new frontend into account though.

## Production

It is also possible to run Superset in non-development mode: in the `docker-compose.yml` file remove
the volumes needed for development and change the variable `SUPERSET_ENV` to `production`.

## Resource Constraints

If you are attempting to build on a Mac and it exits with 137 you need to increase your docker resources.
OSX instructions: https://docs.docker.com/docker-for-mac/#advanced (Search for memory)
