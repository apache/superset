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

Revision ID: 73c5b8e2a194
Revises: e84f26b1c903, 60f94cd6cd11
Create Date: 2026-09-21 00:00:00.000000

"""

revision = "73c5b8e2a194"
down_revision = ("e84f26b1c903", "60f94cd6cd11")


def upgrade() -> None:
    """Join the migration branches without changing schema or data."""


def downgrade() -> None:
    """Restore the parent heads without changing schema or data."""
