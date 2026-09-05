#!/usr/bin/env bash
#
# Licensed to the Apache Software Foundation (ASF) under one or more
# contributor license agreements.  See the NOTICE file distributed with
# this work for additional information regarding copyright ownership.
# The ASF licenses this file to You under the Apache License, Version 2.0
# (the "License"); you may not use this file except in compliance with
# the License.  You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#
set -e

#
# Always install local overrides first
#
/app/docker/docker-bootstrap.sh

if [ "$SUPERSET_LOAD_EXAMPLES" = "yes" ]; then
    STEP_CNT=4
else
    STEP_CNT=3
fi

echo_step() {
cat <<EOF
######################################################################
Init Step ${1}/${STEP_CNT} [${2}] -- ${3}
######################################################################
EOF
}
ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin}"
# If Cypress run – overwrite the password for admin and export env variables
if [ "$CYPRESS_CONFIG" == "true" ]; then
    ADMIN_PASSWORD="general"
    export SUPERSET_TESTENV=true
    export POSTGRES_DB=superset_cypress
    export SUPERSET__SQLALCHEMY_DATABASE_URI=postgresql+psycopg2://superset:superset@db:5432/superset_cypress
fi
# Initialize the database
echo_step "1" "Starting" "Applying DB migrations"
superset db upgrade
echo_step "1" "Complete" "Applying DB migrations"

# Create an admin user
echo_step "2" "Starting" "Setting up admin user ( admin / $ADMIN_PASSWORD )"
if [ "$CYPRESS_CONFIG" == "true" ]; then
    superset load_test_users
else
    superset fab create-admin \
        --username admin \
        --email admin@superset.com \
        --password "$ADMIN_PASSWORD" \
        --firstname Superset \
        --lastname Admin
fi
echo_step "2" "Complete" "Setting up admin user"
# Create default roles and permissions
echo_step "3" "Starting" "Setting up roles and perms"
superset init
echo_step "3" "Complete" "Setting up roles and perms"

if [ "$SUPERSET_LOAD_EXAMPLES" = "yes" ]; then
    # Load some data to play with
    echo_step "4" "Starting" "Loading examples"

    EXAMPLES_LOADED_MARKER="${SUPERSET_HOME}/.examples-loaded"

    # Loading examples parses and inserts every example dataset/dashboard/chart
    # and is one of the slowest steps of `docker compose up`. Once it has
    # succeeded, subsequent `docker-init.sh` runs against the same
    # superset_home volume only need to refresh metadata (e.g. after a
    # `superset db upgrade`), not reload the data itself. Set
    # SUPERSET_FORCE_LOAD_EXAMPLES=yes to force a full reload regardless.
    # Cypress runs always do a full reload since they load a distinct set of
    # test data (`--load-test-data`) into a separate `superset_cypress`
    # database that the metadata-only marker doesn't track.
    if [ -f "$EXAMPLES_LOADED_MARKER" ] && [ "$SUPERSET_FORCE_LOAD_EXAMPLES" != "yes" ] && [ "$CYPRESS_CONFIG" != "true" ]; then
        echo "Examples already loaded, refreshing metadata only (set SUPERSET_FORCE_LOAD_EXAMPLES=yes to force a full reload)"
        superset load_examples --only-metadata
    else
        # If Cypress run which consumes superset_test_config – load required data for tests
        if [ "$CYPRESS_CONFIG" == "true" ]; then
            superset load_examples --load-test-data
        else
            superset load_examples
        fi
        touch "$EXAMPLES_LOADED_MARKER"
    fi
    echo_step "4" "Complete" "Loading examples"
fi
