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
MCP Service Configuration Template

Copy this to `mcp_config.py` and customize:
    cp mcp_config_template.py mcp_config.py
"""

# Enable authentication
MCP_AUTH_ENABLED = True

# JWT configuration
MCP_JWKS_URI = "https://your-auth-provider.com/.well-known/jwks.json"
MCP_JWT_ISSUER = "https://your-auth-provider.com/"
MCP_JWT_AUDIENCE = "superset-mcp-server"
MCP_JWT_ALGORITHM = "RS256"
MCP_REQUIRED_SCOPES = ["superset:read", "superset:query"]

# Alternative: Use RSA public key instead of JWKS
# MCP_JWT_PUBLIC_KEY = """-----BEGIN PUBLIC KEY-----
# Your RSA public key here
# -----END PUBLIC KEY-----"""

# Optional: Custom auth factory for advanced use cases
# def MCP_AUTH_FACTORY(app):
#     # Custom logic here
#     return BearerAuthProvider(...)
