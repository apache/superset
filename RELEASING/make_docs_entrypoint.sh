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
set -e
git clone --branch asf-site https://git-wip-us.apache.org/repos/asf/incubator-superset-site.git /asf-site

# copy html files to temp folder
cp -rv /superset/docs/_build/html/* /asf-site
chown -R ${HOST_UID}:${HOST_UID} /asf-site

cd /asf-site
python -m http.server
