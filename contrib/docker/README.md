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

## Initializing Database

To initialize the database with a user and example charts, dashboards and datasets run:

```bash
docker-compose run -e SUPERSET_LOAD_EXAMPLES=yes --rm superset ./docker-init.sh
```

This may take a minute.

## Normal Operation

To run the container, simply run:

```bash
docker-compose up
```

After several minutes for superset initialization to finish, you can open a browser and view [`http://localhost:8088`](http://localhost:8088) 
to start your journey.

## Map Visualization
To correctly display map visualizations, it is necessary to provide a valid Mapbox access token.
If you already have a Mapbox account, you can find all your tokens on your Mapbox tokens page.
By default, all accounts have a public access token that can be used to access Mapbox's API.
If you want to learn more about Mapbox access tokens, please refer to Mapbox documentation.

Once you have your Mapbox access token, you should set the `MAPBOX_API_KEY` environment variable as follows:
```bash
$> export MAPBOX_API_KEY=<your_access_token>
```
The Compose tool will use the environment variable defined in your shell to populate the value inside the Compose file:
```bash
superset:
  environment:
    MAPBOX_API_KEY: ${MAPBOX_API_KEY}
```

## Developing

While running, the container server will reload on modification of the superset python and javascript source code.
Don't forget to reload the page to take the new frontend into account though.

## Production

It is also possible to run Superset in non-development mode: in the `docker-compose.yml` file remove
the volumes needed for development and change the variable `SUPERSET_ENV` to `production`.

## Resource Constraints

If you are attempting to build on a Mac and it exits with 137 you need to increase your docker resources.
OSX instructions: https://docs.docker.com/docker-for-mac/#advanced (Search for memory)
