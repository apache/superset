#!/usr/bin/env bash

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

# A simple bash script to "compile"/pin our python dependencies using pip-compile

# Let's forward all script arguments to pip-compile
# you can pass things like `--no-upgrade` or target a specific package with `-P "flask"`
pip_compile_flags="$@"

# Compile the base requirements
pip-compile -o requirements/base.txt $pip_compile_flags

# Compile the development requirements with extras
pip-compile -o requirements/development.txt -v $pip_compile_flags \
    --extra bigquery,cors,development,druid,hive,gevent,mysql,postgres,presto,prophet,trino,gsheets,playwright,thumbnails

# Append '-e .' to both requirements files to include the project itself
echo "-e ." >> requirements/base.txt
echo "-e ." >> requirements/development.txt
