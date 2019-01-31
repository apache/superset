#!/usr/bin/env bash

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

# Create an admin user (you will be prompted to set username, first and last name before setting a password)
fabmanager create-admin --app superset

# Initialize the database
superset db upgrade

# Load some data to play with
superset load_examples

# Create default roles and permissions
superset init

# Need to run `npm run build` when enter contains for first time
cd superset/assets && npm run build && cd ../../

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

gunicorn --certfile=${APP_HOME}/cert.pem  --keyfile=${APP_HOME}/privkey.pem -w 50 -k gevent \
  -b  0.0.0.0:8088 \
  --timeout 1200 \
  --limit-request-line 0 \
  --limit-request-field_size 0 \
  superset:app
