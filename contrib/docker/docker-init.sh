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

# Create an admin user (you will be prompted to set username, first and last name before setting a password)
export FLASK_APP="superset.app:create_app()"
flask fab create-admin

# Initialize the database
superset db upgrade

if [ "$SUPERSET_LOAD_EXAMPLES" = "yes" ]; then
    # Load some data to play with
    superset load_examples
fi

# Create default roles and permissions
superset init
