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

export AWS_DEFAULT_REGION=$AWS_DEFAULT_REGION
#
# Always install local overrides first
#

STEP_CNT=4

echo_step() {
cat <<EOF

######################################################################


Init Step ${1}/${STEP_CNT} [${2}] -- ${3}


######################################################################

EOF
}

# Initialize the database
echo_step "1" "Starting" "Applying DB migrations"
superset db upgrade
echo_step "1" "Complete" "Applying DB migrations"

# Create an admin user
echo_step "2" "Starting" "Setting up admin user"
superset fab create-admin \
  --username admin \
  --firstname Peak \
  --lastname SuperUser \
  --email $ADMIN_EMAIL \
  --password $ADMIN_PASSWORD
echo_step "2" "Complete" "Setting up admin user"


# Create default roles and permissions
echo_step "3" "Starting" "Setting up roles and perms"
superset init
echo_step "3" "Complete" "Setting up roles and perms"


# superset fab security-cleanup


echo_step "4" "Starting" "Create Gamma Role"
superset fab create-user \
  --role Gamma \
  --username guest \
  --firstname Peak \
  --lastname Guest \
  --email $GUEST_EMAIL \
  --password $GUEST_PASSWORD
echo_step "4" "Complete" "Create Gamma Role"


echo_step "5" "Starting" "Create Peak User Role"
superset fab create-user \
  --role peak_user \
  --username peakuser \
  --firstname Peak \
  --lastname User \
  --email $PEAK_USER_EMAIL \
  --password $PEAK_USER_PASSWORD
echo_step "5" "Complete" "Create Peak User Role"


echo_step "6" "Starting" "Create Peak Admin Role"
superset fab create-user \
    --role peak_admin \
    --username peakadmin \
    --firstname Peak \
    --lastname Admin \
    --email $PEAK_ADMIN_EMAIL \
    --password $PEAK_ADMIN_PASSWORD
echo_step "6" "Complete" "Create Peak Admin Role"

echo_step "7" "Starting" "Setting up SQLALCHEMY_DATABASE_URI URL"
superset set_database_uri \
  --database_name PeakDataModel \
  --uri $SQLALCHEMY_DATABASE_URI
echo_step "7" "Complete" "Setting up SQLALCHEMY_DATABASE_URI URL"


echo_step "8" "Starting" "Setting up Redshift Database URL"
superset set_database_uri \
  --database_name RedshiftDB \
  --uri $REDSHIFT_DATABASE_URI
echo_step "8" "Complete" "Setting up Redshift Database URL"
