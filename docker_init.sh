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
set -ex

# Create an admin user
export FLASK_APP=superset:app
export AWS_DEFAULT_REGION=$AWS_DEFAULT_REGION

flask fab create-admin \
  --username admin \
  --firstname Peak \
  --lastname SuperUser \
  --email $ADMIN_EMAIL \
  --password $ADMIN_PASSWORD

# Initialize the database
superset db upgrade

# Create default roles and permissions
superset init

flask fab create-user \
  --role Gamma \
  --username guest \
  --firstname Peak \
  --lastname Guest \
  --email $GUEST_EMAIL \
  --password $GUEST_PASSWORD

flask fab create-user \
  --role peak_user \
  --username peakuser \
  --firstname Peak \
  --lastname User \
  --email $PEAK_USER_EMAIL \
  --password $PEAK_USER_PASSWORD

  flask fab create-user \
    --role peak_admin \
    --username peakadmin \
    --firstname Peak \
    --lastname Admin \
    --email $PEAK_ADMIN_EMAIL \
    --password $PEAK_ADMIN_PASSWORD

superset set_database_uri \
  --database_name RedshiftDB \
  --uri $REDSHIFT_DATABASE_URI
