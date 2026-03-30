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
Schemas for advanced data types
"""

from marshmallow import fields, Schema

advanced_data_type_convert_schema = {
    "type": "object",
    "properties": {
        "type": {"type": "string", "default": "port"},
        "values": {
            "type": "array",
            "items": {"default": "http"},
            "minItems": 1,
        },
    },
    "required": ["type", "values"],
}


class AdvancedDataTypeSchema(Schema):
    """
    AdvancedDataType response schema
    """

    error_message = fields.String()
    values = fields.List(
        fields.String(metadata={"description": "parsed value (can be any value)"})
    )
    display_value = fields.String(
        metadata={"description": "The string representation of the parsed values"}
    )
    valid_filter_operators = fields.List(fields.String())
