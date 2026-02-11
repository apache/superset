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
"""Add translations column to dashboards and slices.

The translations column stores user-generated content translations
in JSON format:

    {
        "field_name": {
            "locale": "translated_value"
        }
    }

Example for dashboards:

    {
        "dashboard_title": {"de": "Verkaufs-Dashboard", "fr": "Tableau de bord"},
        "description": {"de": "Monatlicher Verkaufsbericht"}
    }

Example for slices:

    {
        "slice_name": {"de": "Umsatz nach Region", "fr": "Chiffre d'affaires"},
        "description": {"de": "Quartalsumsatz nach Vertriebsregion"}
    }

This enables localization of user-created content (dashboard titles,
chart names, filter labels) based on the viewer's UI language setting.
Controlled by ENABLE_CONTENT_LOCALIZATION feature flag.

Revision ID: 1af0da0adfec
Revises: 9787190b3d89
Create Date: 2026-02-04 14:00:00.000000

"""

from sqlalchemy import Column, JSON

from superset.migrations.shared.utils import add_columns, drop_columns

# revision identifiers, used by Alembic.
revision = "1af0da0adfec"
down_revision = "9787190b3d89"

DASHBOARDS_TABLE = "dashboards"
SLICES_TABLE = "slices"
TRANSLATIONS_COLUMN = "translations"


def upgrade() -> None:
    """Add translations column to dashboards and slices tables."""
    add_columns(
        DASHBOARDS_TABLE,
        Column(TRANSLATIONS_COLUMN, JSON, nullable=True),
    )
    add_columns(
        SLICES_TABLE,
        Column(TRANSLATIONS_COLUMN, JSON, nullable=True),
    )


def downgrade() -> None:
    """Remove translations column from dashboards and slices tables."""
    drop_columns(DASHBOARDS_TABLE, TRANSLATIONS_COLUMN)
    drop_columns(SLICES_TABLE, TRANSLATIONS_COLUMN)
