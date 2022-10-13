---
title: Adding New Drivers in Docker
hide_title: true
sidebar_position: 2
version: 1
---

## Adding New Database Drivers in Docker

Superset requires a Python database driver to be installed for each additional type of database you
want to connect to. When setting up Superset locally via `docker-compose`, the drivers and packages
contained in
[requirements.txt](https://github.com/apache/superset/blob/master/requirements.txt) and
[requirements-dev.txt](https://github.com/apache/superset/blob/master/requirements-dev.txt)
will be installed automatically.

In this section, we'll walk through how to install the MySQL connector library. The connector
library installation process is the same for all additional libraries and we'll end this section
with the recommended connector library for each database.

### 1. Determine the driver you need

To figure out how to install the [database driver](/docs/databases/installing-database-drivers) of your choice.

In the example, we'll walk through the process of installing a MySQL driver in Superset.

### 2. Install MySQL Driver

As we are currently running inside of a Docker container via `docker compose`, we cannot simply run
`pip install mysqlclient` on our local shell and expect the drivers to be installed within the
Docker containers for superset.

In order to address this, the Superset `docker compose` setup comes with a mechanism for you to
install packages locally, which will be ignored by Git for the purposes of local development. Please
follow these steps:

Create `requirements-local.txt`

```
# From the repo root...
touch ./docker/requirements-local.txt
```

Add the driver selected in step above:

```
echo "mysqlclient" >> ./docker/requirements-local.txt
```

Rebuild your local image with the new driver baked in:

```
docker-compose build --force-rm
```

After the rebuild of the Docker images is complete (which make take a few minutes) you can relaunch using the following command:

```
docker-compose up
```

The other option is to start Superset via Docker Compose is using the recipe in `docker-compose-non-dev.yml`, which will use pre-built frontend assets and skip the building of front-end assets:

```
docker-compose -f docker-compose-non-dev.yml pull
docker-compose -f docker-compose-non-dev.yml up
```

### 3. Connect to MySQL

Now that you've got a MySQL driver installed locally, you should be able to test it out.

We can now create a Datasource in Superset that can be used to connect to a MySQL instance. Assuming
your MySQL instance is running locally and can be accessed via localhost, use the following
connection string in “SQL Alchemy URI”, by going to Sources > Databases > + icon (to add a new
datasource) in Superset.

For Docker running in Linux:

```
mysql://mysqluser:mysqluserpassword@localhost/example?charset=utf8
```

For Docker running in OSX:

```
mysql://mysqluser:mysqluserpassword@docker.for.mac.host.internal/example?charset=utf8
```

Then click “Test Connection”, which should give you an “OK” message. If not, please look at your
terminal for error messages, and reach out for help.

You can repeat this process for every database you want superset to be able to connect to.
