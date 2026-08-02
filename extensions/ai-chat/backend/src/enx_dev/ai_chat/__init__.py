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
"""AI chat gateway.

Backend half of the AI assistant chat extension. It authenticates the current
Superset user, invokes a configured model provider, and orchestrates MCP tools
under the user's own authorization context, with server-enforced approvals for
mutating operations.

Operators configure it through ``AI_CHAT_CONFIG`` in ``superset_config.py``;
the shipped defaults and every supported key live in
:mod:`enx_dev.ai_chat.settings`.
"""
