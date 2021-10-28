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
set -eo pipefail

export AWS_DEFAULT_REGION=$AWS_DEFAULT_REGION
DEFAULT_NO_OF_WORKERS=$((2 * $(getconf _NPROCESSORS_ONLN) + 1))

if [ "${#}" -ne 0 ]; then
    exec "${@}"
elif [ "$SUPERSET_ENV" = "development" ]; then
    supervisord -nc supervisord.conf & sleep 10 &&
    celery beat --app=superset.tasks.celery_app:app &
    # needed by superset runserver
    (cd superset/superset-frontend/ && npm ci)
    (cd superset/superset-frontend/ && npm run dev) &
    FLASK_ENV=development FLASK_APP=superset:app superset run -p 8088 --with-threads --reload --debugger --host=0.0.0.0
elif [ "$SUPERSET_ENV" = "production" ]; then
    pwd &&
    supervisord -nc /usr/bin/supervisord.conf & sleep 10 &&
    celery --app=superset.tasks.celery_app:app beat --pidfile /tmp/celerybeat.pid -s /tmp/celerybeat-schedule &
    exec gunicorn \
        --bind  "0.0.0.0:${SUPERSET_PORT}" \
        --access-logfile '-' \
        --workers ${NO_OF_WORKERS:-$DEFAULT_NO_OF_WORKERS} \
        --timeout 180 \
        --worker-class gthread \
        --threads 20 \
        --keep-alive 5 \
        --limit-request-line 0 \
        --limit-request-field_size 0 \
        "${FLASK_APP}"
else
    superset --help
fi
