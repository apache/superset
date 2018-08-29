#!/usr/bin/env bash

set -ex

  echo "Initializing database"
  superset db upgrade

  echo "Creating default roles and permissions"
  superset init

  cd superset/assets && yarn && yarn run build && cd ../../
# To start a development web server, use the -d switch
  superset runserver
