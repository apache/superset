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

#!/bin/bash

# Function to determine Python command
get_python_command() {
    if command -v python3 &>/dev/null; then
        echo "python3"
    else
        echo "python"
    fi
}

# Function to determine Pip command
get_pip_command() {
    if command -v pip3 &>/dev/null; then
        echo "pip3"
    else
        echo "pip"
    fi
}

PYTHON=$(get_python_command)
PIP=$(get_pip_command)

# Get the release directory's path. If you unzip an Apache release and just run the npm script to validate the release, this will be a file name like `apache-superset-x.x.xrcx-source.tar.gz`
RELEASE_DIR_NAME="../../$(basename "$(dirname "$(pwd)")").tar.gz"

# Install dependencies from requirements.txt if the file exists
if [ -f "path/to/requirements.txt" ]; then
    echo "Installing Python dependencies..."
    $PYTHON -m $PIP install -r path/to/requirements.txt
fi

# echo $PYTHON
# echo $RELEASE_DIR_NAME

# Run the Python script with the parent directory name as an argument
$PYTHON ../RELEASING/verify_release.py "$RELEASE_DIR_NAME"
