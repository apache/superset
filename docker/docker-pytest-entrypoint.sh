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

set -e

# Handle database setup based on FORCE_RELOAD
if [ "${FORCE_RELOAD}" = "true" ]; then
  echo "Force reload requested - resetting test database"
  # Drop and recreate the test database using Python
  python3 -c "
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

# Connect to default database
conn = psycopg2.connect(host='db-light', user='superset', password='superset', database='superset_light')
conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
cur = conn.cursor()

# Drop and recreate test database
try:
    cur.execute('DROP DATABASE IF EXISTS test')
except:
    pass

cur.execute('CREATE DATABASE test')
conn.close()

# Connect to test database to create schemas
conn = psycopg2.connect(host='db-light', user='superset', password='superset', database='test')
conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
cur = conn.cursor()

cur.execute('CREATE SCHEMA sqllab_test_db')
cur.execute('CREATE SCHEMA admin_database')

cur.close()
conn.close()
print('Test database reset successfully')
"
  # Use --no-reset-db since we already reset it
  FLAGS="--no-reset-db"
else
  echo "Using existing test database (set FORCE_RELOAD=true to reset)"
  FLAGS="--no-reset-db"

  # Ensure test database exists using Python
  python3 -c "
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

# Check if test database exists
try:
    conn = psycopg2.connect(host='db-light', user='superset', password='superset', database='test')
    conn.close()
    print('Test database already exists')
except:
    print('Creating test database...')
    # Connect to default database to create test database
    conn = psycopg2.connect(host='db-light', user='superset', password='superset', database='superset_light')
    conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    cur = conn.cursor()

    # Create test database
    cur.execute('CREATE DATABASE test')
    conn.close()

    # Connect to test database to create schemas
    conn = psycopg2.connect(host='db-light', user='superset', password='superset', database='test')
    conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    cur = conn.cursor()

    cur.execute('CREATE SCHEMA IF NOT EXISTS sqllab_test_db')
    cur.execute('CREATE SCHEMA IF NOT EXISTS admin_database')

    cur.close()
    conn.close()
    print('Test database created successfully')
"
fi

# Initialize test environment directly
if [ "${FORCE_RELOAD}" = "true" ] || [ ! -f "/app/superset_home/.test_initialized" ]; then
  echo "Initializing test environment..."
  # Run the same commands that scripts/tests/run.sh would run
  cd /app
  superset db upgrade 2>/dev/null || true
  superset init 2>/dev/null || true
  superset load-test-users 2>/dev/null || true

  # Mark as initialized
  touch /app/superset_home/.test_initialized
else
  echo "Test environment already initialized"
fi

# If arguments provided, execute them
if [ $# -gt 0 ]; then
  exec "$@"
fi
