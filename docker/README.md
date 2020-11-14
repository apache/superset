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

# Getting Started with Superset using Docker

Docker is an easy way to get started with Superset.

## Prerequisites

1. Docker! [link](https://www.docker.com/get-started)
1. Docker-compose [link](https://docs.docker.com/compose/install/)

## Configuration

The `/app/pythonpath` folder is mounted from [./docker/pythonpath_dev](./docker/pythonpath_dev)
which contains a base configuration [./docker/pythonpath_dev/superset_config.py](./docker/pythonpath_dev/superset_config.py)
intended for use with local development.

### Local overrides

In order to override configuration settings locally, simply make a copy of [./docker/pythonpath_dev/superset_config_local.example](./docker/pythonpath_dev/superset_config_local.example)
into [./docker/pythonpath_dev/superset_config_docker.py](./docker/pythonpath_dev/superset_config_docker.py) (git ignored) and fill in your overrides.

### Local packages

If you want to add python packages in order to test things like DBs locally, you can simply add a local requirements.txt (./docker/requirements-local.txt)
and rebuild your docker stack.

Steps:
    1. Create ./docker/requirements-local.txt
    2. Add your new packages
    3. Rebuild docker-compose
        a. `docker-compose down -v`
        b. `docker-compose up`

## Initializing Database

The DB will initialize itself upon startup via the init container (superset-init)
(This may take a minute.)

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
