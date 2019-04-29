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
set -ex

cd /tmp
git clone --depth 1 --branch $VERSION https://github.com/apache/incubator-superset.git
mkdir ~/$VERSION
cd incubator-superset && \
git archive \
    --format=tar.gz HEAD \
    -o ~/$VERSION/apache-incubator-superset.tar.gz

ls /root/.gnupg
#gpg --armor --output apache-incubator-superset.tar.gz.asc --detach-sig apache-incubator-superset.tar.gz
#gpg --print-md SHA512 apache-incubator-superset.tar.gz > apache-incubator-superset.tar.gz.sha512
