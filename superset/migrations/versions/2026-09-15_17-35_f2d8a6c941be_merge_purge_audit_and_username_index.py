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
"""Merge purge-audit coordination and username-index migration heads.

Revision ID: f2d8a6c941be
Revises: c7f53d184ea2, 88a01c781622
Create Date: 2026-09-15 17:35:00.000000
"""

revision = "f2d8a6c941be"
down_revision = ("c7f53d184ea2", "88a01c781622")


def upgrade() -> None:
    """Join both completed migration branches without changing schema."""
    pass


def downgrade() -> None:
    """Restore the two parent heads without changing schema."""
    pass
