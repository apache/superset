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
Helper function to extract row data from MCP responses.

The MCP client seems to wrap dict rows in Root objects.
This helper handles the extraction properly.
"""


def extract_row_data(row):
    """Extract dictionary data from a row object."""
    # Handle different possible formats
    if isinstance(row, dict):
        return row

    # Check for Pydantic Root object
    if hasattr(row, "__root__"):
        return row.__root__

    # Check if it's a Pydantic model with model_dump
    if hasattr(row, "model_dump"):
        return row.model_dump()

    # Try to access __dict__ directly
    if hasattr(row, "__dict__"):
        # Filter out private attributes
        return {k: v for k, v in row.__dict__.items() if not k.startswith("_")}

    # Last resort - convert to string and parse
    # This is for the Root object issue
    row_str = str(row)
    if row_str == "Root()":
        # Empty Root object - the actual data might be elsewhere
        # Let's check all attributes
        attrs = dir(row)
        for attr in attrs:
            if not attr.startswith("_") and attr not in [
                "model_dump",
                "model_validate",
            ]:
                try:
                    val = getattr(row, attr)
                    if isinstance(val, dict):
                        return val
                except AttributeError:
                    pass

    raise ValueError(f"Cannot extract data from row of type {type(row)}: {row}")
