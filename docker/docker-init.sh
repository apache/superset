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

# Loading examples parses and inserts every example dataset, chart and
# dashboard and is one of the slowest steps of `docker compose up`. Rather
# than trusting a marker file (which goes stale as soon as the database volume
# is recreated), ask the databases themselves: when both the example data and
# the dashboards imported from it are present, the previous load completed and
# there is nothing left to redo. Any failure here (missing tables, unreachable
# database, import error) simply reports "not loaded" so the full load runs.
examples_already_loaded() {
    python - <<'PY' 2>/dev/null
import sys

from superset.app import create_app
from superset.sql.parse import Table

app = create_app()
with app.app_context():
    from superset import db
    from superset.models.dashboard import Dashboard
    from superset.utils.database import get_example_database

    has_dashboard = (
        db.session.query(Dashboard).filter_by(slug="world_health").first() is not None
    )
    has_data = get_example_database().has_table(Table("wb_health_population"))
    sys.exit(0 if has_dashboard and has_data else 1)
PY
}

if [ "$SUPERSET_LOAD_EXAMPLES" = "yes" ]; then
    echo_step "4" "Starting" "Loading examples"

    # Cypress runs always load, since they need a distinct set of test data
    # (`--load-test-data`) in a separate database. Set
    # SUPERSET_FORCE_LOAD_EXAMPLES=yes to reload the examples regardless.
    if [ "$CYPRESS_CONFIG" == "true" ]; then
        superset load_examples --load-test-data
    elif [ "$SUPERSET_FORCE_LOAD_EXAMPLES" != "yes" ] && examples_already_loaded; then
        echo "Examples already loaded, skipping (set SUPERSET_FORCE_LOAD_EXAMPLES=yes to reload them)"
    else
        superset load_examples
    fi
    echo_step "4" "Complete" "Loading examples"
fi
