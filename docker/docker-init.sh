#!/usr/bin/env bash

set -ex

  if [ $IS_KERBEROS_ENABLED ]; then
    echo "running kerberised superset"
    sh /usr/local/bin/auth-kerberized.sh
  fi

  echo "Initializing database"
  superset db upgrade

  echo "Creating default roles and permissions"
  superset init

# To start a development web server, use the -d switch
  superset runserver
