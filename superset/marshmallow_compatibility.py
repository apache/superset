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
Marshmallow 4.x Compatibility Module for Flask-AppBuilder 5.0.0

This module provides compatibility between Flask-AppBuilder 5.0.0 and
marshmallow 4.x, specifically handling missing auto-generated fields
during schema initialization.
"""

import logging
from typing import Any, TYPE_CHECKING

from marshmallow import fields

if TYPE_CHECKING:
    import marshmallow

logger = logging.getLogger(__name__)


def patch_marshmallow_for_flask_appbuilder() -> None:
    """
    Patches marshmallow Schema._init_fields to handle Flask-AppBuilder 5.0.0
    compatibility with marshmallow 4.x.

    Flask-AppBuilder 5.0.0 automatically generates schema fields that reference
    SQL relationship fields that may not exist in marshmallow 4.x's stricter
    field validation. This patch dynamically adds missing fields as Raw fields
    to prevent KeyError exceptions during schema initialization.
    """
    import marshmallow

    # Store the original method
    original_init_fields = marshmallow.Schema._init_fields

    def patched_init_fields(self: "marshmallow.Schema") -> Any:
        """Patched version that handles missing declared fields."""
        max_retries = 10  # Prevent infinite loops in case of unexpected errors
        retries = 0

        while retries < max_retries:
            try:
                return original_init_fields(self)
            except KeyError as e:
                # Extract the missing field name from the KeyError
                missing_field = str(e).strip("'\"")

                # Initialize declared_fields if it doesn't exist
                if not hasattr(self, "declared_fields"):
                    self.declared_fields = {}

                # Only add if it doesn't already exist
                if missing_field not in self.declared_fields:
                    # Use Raw field as a safe fallback for unknown auto-generated
                    # fields. Allow both load and dump to support both input
                    # validation and serialization
                    self.declared_fields[missing_field] = fields.Raw(
                        allow_none=True,
                        load_default=None,  # Optional field (defaults to None)
                    )

                    logger.debug(
                        "Marshmallow compatibility: Added missing field "
                        "'%s' as Raw field",
                        missing_field,
                    )

                retries += 1
                # Continue the loop to retry initialization

        # If we've exhausted retries, something is seriously wrong
        raise RuntimeError(
            f"Marshmallow field initialization failed after {max_retries} retries"
        )

    # Apply the patch
    marshmallow.Schema._init_fields = patched_init_fields
