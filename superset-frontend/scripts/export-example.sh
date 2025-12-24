#!/bin/bash
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
# Export a dashboard as an example using the Superset CLI
# Usage: ./scripts/export-example.sh <dashboard-id> [name]
#
# If name is not provided, the script will use a sanitized version of the dashboard title.

set -e

if [ -z "$1" ]; then
    echo "Usage: npm run export-example -- <dashboard-id> [name]"
    echo ""
    echo "Examples:"
    echo "  npm run export-example -- 1 world_health"
    echo "  npm run export-example -- 5 covid_vaccines"
    echo ""
    echo "The exported example will be placed in superset/examples/exports/"
    exit 1
fi

DASHBOARD_ID="$1"
NAME="${2:-}"

# Change to project root (parent of superset-frontend)
cd "$(dirname "$0")/../.."

# If no name provided, query the dashboard title and sanitize it
if [ -z "$NAME" ]; then
    echo "Fetching dashboard title..."
    NAME=$(docker compose exec -T superset python -c "
from superset.app import create_app
app = create_app()
with app.app_context():
    from superset import db
    from superset.models.dashboard import Dashboard
    d = db.session.query(Dashboard).filter_by(id=$DASHBOARD_ID).first()
    if d:
        import re
        name = re.sub(r'[^a-z0-9]+', '_', d.dashboard_title.lower()).strip('_')
        print(name)
    else:
        print('')
" 2>/dev/null | tail -1)

    if [ -z "$NAME" ]; then
        echo "Error: Dashboard with ID $DASHBOARD_ID not found"
        exit 1
    fi
    echo "Using name: $NAME"
fi

echo "Exporting dashboard $DASHBOARD_ID as '$NAME'..."
docker compose exec superset superset export-example -d "$DASHBOARD_ID" -n "$NAME" -f
