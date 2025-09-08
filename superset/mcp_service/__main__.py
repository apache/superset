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
MCP Service entry point for running as a module.

This allows the service to be run with: python -m superset.mcp_service
"""

import sys
from typing import NoReturn


def main() -> NoReturn:
    """
    Main entry point for the MCP service.

    This is a minimal scaffolding implementation that will be extended
    in subsequent PRs with the actual service functionality.
    """
    print("Superset MCP Service - Scaffolding Version")
    print("This is the foundational structure for the MCP service.")
    print("Full implementation will be added in subsequent PRs.")
    sys.exit(0)


if __name__ == "__main__":
    main()
