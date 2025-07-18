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

# Unified documentation generation script
# This script generates all dynamic documentation artifacts needed for the docs build

set -e

echo "🚀 Generating documentation artifacts..."

# Navigate to the docs directory
cd "$(dirname "$0")/.."

# Track any failures
FAILED_TASKS=()

# 1. Export configuration metadata
echo "📊 Exporting configuration metadata..."
if python scripts/export_config_metadata.py; then
    echo "✅ Configuration metadata exported successfully"
else
    echo "⚠️  Warning: Failed to export configuration metadata"
    echo "   The documentation build will continue with existing metadata"
    FAILED_TASKS+=("config_metadata")
fi

# 2. Generate OpenAPI documentation
echo "🔌 Generating OpenAPI documentation..."
if python -c "
import sys
sys.path.insert(0, '..')
from superset.app import create_app
from superset.cli.update import update_api_docs
from flask.cli import with_appcontext
import os

# Set required environment variables
os.environ['SUPERSET_SECRET_KEY'] = 'not-a-secret'

app = create_app()
with app.app_context():
    update_api_docs()
"; then
    echo "✅ OpenAPI documentation generated successfully"
else
    echo "⚠️  Warning: Failed to generate OpenAPI documentation"
    echo "   The documentation build will continue with existing OpenAPI spec"
    FAILED_TASKS+=("openapi")
fi

# 3. Generate ERD (Entity Relationship Diagram) if in CI environment
if [ -n "$CI" ] && [ -f "../scripts/erd/erd.py" ]; then
    echo "🗂️  Generating Entity Relationship Diagram..."
    if python ../scripts/erd/erd.py; then
        echo "✅ ERD generated successfully"
    else
        echo "⚠️  Warning: Failed to generate ERD"
        echo "   The documentation build will continue without updated ERD"
        FAILED_TASKS+=("erd")
    fi
fi

# Summary
echo ""
echo "📝 Documentation generation summary:"
echo "   - Configuration metadata: ${FAILED_TASKS[*]}" | grep -q "config_metadata" && echo "   - Configuration metadata: ❌ Failed" || echo "   - Configuration metadata: ✅ Success"
echo "   - OpenAPI documentation: ${FAILED_TASKS[*]}" | grep -q "openapi" && echo "   - OpenAPI documentation: ❌ Failed" || echo "   - OpenAPI documentation: ✅ Success"
if [ -n "$CI" ]; then
    echo "   - ERD generation: ${FAILED_TASKS[*]}" | grep -q "erd" && echo "   - ERD generation: ❌ Failed" || echo "   - ERD generation: ✅ Success"
fi

if [ ${#FAILED_TASKS[@]} -eq 0 ]; then
    echo ""
    echo "🎉 All documentation artifacts generated successfully!"
else
    echo ""
    echo "⚠️  Some tasks failed but documentation build can continue"
    echo "   Failed tasks: ${FAILED_TASKS[*]}"
    echo "   To fix missing dependencies, run: pip install -e ."
fi

echo ""
echo "📁 Generated files:"
[ -f "src/resources/config_metadata.json" ] && echo "   - src/resources/config_metadata.json"
[ -f "static/resources/openapi.json" ] && echo "   - static/resources/openapi.json"
[ -f "static/img/erd.svg" ] && echo "   - static/img/erd.svg"
