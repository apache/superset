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
Superset MCP (Model Context Protocol) Service

This module provides a FastMCP-based service that exposes Superset functionality
through the Model Context Protocol, allowing AI assistants and tools to interact
with Superset for data visualization and analysis.

The service provides tools for:
- Chart creation and management
- Dashboard operations
- Dataset exploration
- SQL execution
- System information access

This is the core scaffolding that establishes the foundation for the MCP service
without implementing the full functionality.
"""

from typing import List, TYPE_CHECKING

if TYPE_CHECKING:
    # Import types only during type checking to avoid circular imports
    pass

__version__ = "0.1.0"
__all__: List[str] = []
