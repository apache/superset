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
"""metric currency should be JSON

Revision ID: f1edd4a4d4f2
Revises: 378cecfdba9f
Create Date: 2025-04-30 11:04:39.105229

"""

from superset.migrations.shared.utils import (
    cast_json_column_to_text,
    cast_text_column_to_json,
)

# revision identifiers, used by Alembic.
revision = "f1edd4a4d4f2"
down_revision = "378cecfdba9f"


def upgrade():
    """
    Convert the currency column to JSON.
    """
    cast_text_column_to_json("sql_metrics", "currency")


def downgrade():
    """
    Convert the currency column back to text.
    """
    cast_json_column_to_text("sql_metrics", "currency")
