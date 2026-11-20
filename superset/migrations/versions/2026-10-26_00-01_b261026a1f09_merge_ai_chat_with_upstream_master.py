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
"""Merge the AI chat and upstream migration branches.

Revision ID: b261026a1f09
Revises: a37d29f64b81, d623a0cb6bb0
Create Date: 2026-10-26 00:01:00.000000

"""

revision = "b261026a1f09"
down_revision = ("a37d29f64b81", "d623a0cb6bb0")


def upgrade() -> None:
    """Join the migration branches without changing schema or data."""


def downgrade() -> None:
    """Restore the parent heads without changing schema or data."""
