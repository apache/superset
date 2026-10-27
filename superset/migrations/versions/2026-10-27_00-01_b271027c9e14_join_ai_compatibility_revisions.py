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
"""Join the AI compatibility migration revisions.

Revision ID: b271027c9e14
Revises: b7d6ce912f40, b261026a1f09
Create Date: 2026-10-27 00:01:00.000000

"""

revision = "b271027c9e14"
down_revision = ("b7d6ce912f40", "b261026a1f09")


def upgrade() -> None:
    """Join the revisions without changing schema or data."""


def downgrade() -> None:
    """Restore the parent revisions without changing schema or data."""
