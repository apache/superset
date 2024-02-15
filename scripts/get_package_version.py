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
import json
import os

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
PACKAGE_JSON = os.path.join(BASE_DIR, "../", "superset-frontend", "package.json")


if os.path.exists(PACKAGE_JSON):
    # package.json is the source of truth for version info
    with open(PACKAGE_JSON) as f:
        print(json.load(f)["version"])
