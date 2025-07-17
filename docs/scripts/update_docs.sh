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

# Update documentation with latest configuration metadata
# This script should be run before building the documentation

set -e

echo "Updating configuration metadata for documentation..."

# Navigate to the docs directory
cd "$(dirname "$0")/.."

# Export configuration metadata
echo "Exporting configuration metadata..."
python scripts/export_config_metadata.py

echo "Configuration metadata updated successfully!"
echo "The following files were updated:"
echo "- src/resources/config_metadata.json"
echo ""
echo "To build the documentation with the latest metadata:"
echo "  npm install"
echo "  npm run build"
