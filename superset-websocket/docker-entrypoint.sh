#!/usr/bin/env sh
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

prefix=GAQ_
[ "$LOG_LEVEL" = "debug" ] && echo "Environment variables"
for VAR in $(env); do
   name=$(echo "$VAR" | cut -d'=' -f1)
   value=$(echo "$VAR" | cut -d'=' -f2)
   if echo "$name" | grep -q "^$prefix[^#0-9].*"; then
    new_name="${name#$prefix}"
    export "$new_name=$value"
    unset "$name"
    [ "$LOG_LEVEL" = "debug" ] && echo "$new_name: $value"
  fi
done

exec "$@"
