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

if [ "${#}" -ne 0 ]; then
    exec "${@}"
else
    gunicorn \
        --bind  "0.0.0.0:${SUPERSET_PORT}" \
        --access-logfile '-' \
        --error-logfile '-' \
        --workers 1 \
        --worker-class gthread \
        --threads 20 \
        --timeout ${GUNICORN_TIMEOUT:-60} \
        --limit-request-line 0 \
        --limit-request-field_size 0 \
        "${FLASK_APP}"
fi
