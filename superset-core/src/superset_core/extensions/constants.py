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
Constants for extension validation and naming.
"""

# Publisher validation pattern: lowercase letters, numbers, hyphens; must start with
# letter; no consecutive hyphens or trailing hyphens
PUBLISHER_PATTERN = r"^[a-z]([a-z0-9]*(-[a-z0-9]+)*)?$"

# Technical name validation pattern: lowercase letters, numbers, hyphens; must start
# with letter; no consecutive hyphens or trailing hyphens
TECHNICAL_NAME_PATTERN = r"^[a-z]([a-z0-9]*(-[a-z0-9]+)*)?$"

# Display name validation pattern: must start with letter, can contain letters,
# numbers, spaces, hyphens, underscores, dots
DISPLAY_NAME_PATTERN = r"^[a-zA-Z][a-zA-Z0-9\s\-_\.]*$"

# Version pattern for semantic versioning
VERSION_PATTERN = r"^\d+\.\d+\.\d+$"
