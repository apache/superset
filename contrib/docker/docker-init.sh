#!/usr/bin/env bash

set -ex

# Create an admin user (you will be prompted to set username, first and last name before setting a password)
fabmanager create-admin --app superset

# Initialize the database
superset db upgrade

# Load some data to play with
superset load-examples

# Create default roles and permissions
superset init

# Need to run `npm run build` when enter contains for first time
cd superset/assets && npm run build && cd ../../

# Start superset worker for SQL Lab
superset worker &

# To start a development web server, use the -d switch
superset runserver -d
