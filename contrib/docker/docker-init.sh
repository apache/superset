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

export APP_NAME=superset
export APP_HOME=/home/work

if [ "${ENVIRONMENT}" = "" ] || [ "${STACK}" = "" ]; then
    echo "ENVIRONMENT and STACK environment variables must be set" >&2
    exit 1
fi

# autodetect AWS_REGION if not specified
if [ "${AWS_REGION}" = "" ]; then
    EC2_AVAIL_ZONE=`curl -s http://169.254.169.254/latest/meta-data/placement/availability-zone`
    EC2_REGION="`echo \"$EC2_AVAIL_ZONE\" | sed -e 's:\([0-9][0-9]*\)[a-z]*\$:\\1:'`"
    export AWS_REGION="${EC2_REGION}"
fi

# Initialize the database
superset db upgrade

if [ "$SUPERSET_LOAD_EXAMPLES" = "yes" ]; then
    # Load some data to play with
    superset load_examples
fi

# Create default roles and permissions
superset init

# Start superset worker for SQL Lab
superset worker &

# fetch SSL certificates
for name in cert privkey ; do
    aws ssm get-parameter \
        --region "${AWS_REGION}" \
        --with-decryption \
        --output text --query "Parameter.Value" \
        --name "/${ENVIRONMENT}/${STACK}/ssl/${name}" \
        > "${APP_HOME}/${name}.pem"
done

gunicorn -k gevent \
  -b  0.0.0.0:8088 \
  --timeout 1200 \
  --limit-request-line 0 \
  --limit-request-field_size 0 \
  superset:app
