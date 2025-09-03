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

"""
Configuration settings for the Query Sidecar Service integration.

This file contains configuration options for integrating Superset with
the Node.js Query Sidecar Service that generates QueryObjects from form_data.
"""

# Query Sidecar Service Configuration
# Enable or disable the query sidecar service integration
QUERY_SIDECAR_ENABLED = True

# Base URL for the Node.js query sidecar service
# This service transforms form_data into QueryObjects for Alerts & Reports
QUERY_SIDECAR_BASE_URL = "http://localhost:3001"

# Timeout for sidecar service requests in seconds
QUERY_SIDECAR_TIMEOUT = 10

# Example production configuration:
# QUERY_SIDECAR_BASE_URL = "http://superset-query-sidecar:3001"
# QUERY_SIDECAR_ENABLED = True
# QUERY_SIDECAR_TIMEOUT = 30

# Example Docker Compose setup:
# services:
#   superset-query-sidecar:
#     image: superset-query-sidecar:latest
#     ports:
#       - "3001:3001"
#     environment:
#       - NODE_ENV=production
#       - SUPERSET_ORIGINS=http://localhost:8088
#   
#   superset:
#     # ... your superset config
#     environment:
#       - QUERY_SIDECAR_BASE_URL=http://superset-query-sidecar:3001