#!/bin/bash
# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.


# This script generates .json files from .po translation files
# these json files are used by the frontend to load translations

set -e

for file in $( find ../superset/translations/** -name '*.po' );
do
  extension=${file##*.}
  filename="${file%.*}"
  if [ $extension == "po" ]
  then
    echo "po2json --domain superset --format jed1.x $file $filename.json"
    po2json --domain superset --format jed1.x $file $filename.json
    prettier --write $filename.json
  fi
done
