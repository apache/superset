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
Label helpers for SEMANTIC_LAYERS feature flag.

When the SEMANTIC_LAYERS feature flag is enabled the UI broadens
"dataset" → "datasource" and "database" → "data connection" so
that semantic views and semantic layers feel like first-class
citizens alongside traditional datasets and database connections.

Mirror of superset-frontend/src/utils/semanticLayerLabels.ts.
"""

from __future__ import annotations

from flask_babel import lazy_gettext as _


def _sl(legacy: str, semantic: str) -> str:
    """Return *semantic* when SEMANTIC_LAYERS is enabled, else *legacy*."""
    # Imported lazily to avoid a circular import at module load time
    # (superset.utils.semantic_layer_labels is imported by superset.initialization,
    # which is itself imported during superset package initialization).
    from superset import feature_flag_manager  # pylint: disable=import-outside-toplevel

    return (
        semantic
        if feature_flag_manager.is_feature_enabled("SEMANTIC_LAYERS")
        else legacy
    )


# ---------------------------------------------------------------------------
# "dataset" family
# ---------------------------------------------------------------------------


def dataset_label() -> str:
    """Capitalized singular: "Dataset" / "Datasource" """
    return _sl(_("Dataset"), _("Datasource"))


def dataset_label_lower() -> str:
    """Lower-case singular: "dataset" / "datasource" """
    return _sl(_("dataset"), _("datasource"))


def datasets_label() -> str:
    """Capitalized plural: "Datasets" / "Datasources" """
    return _sl(_("Datasets"), _("Datasources"))


def datasets_label_lower() -> str:
    """Lower-case plural: "datasets" / "datasources" """
    return _sl(_("datasets"), _("datasources"))


# ---------------------------------------------------------------------------
# "database" family
# ---------------------------------------------------------------------------


def database_label() -> str:
    """Capitalized singular: "Database" / "Data connection" """
    return _sl(_("Database"), _("Data connection"))


def database_label_lower() -> str:
    """Lower-case singular: "database" / "data connection" """
    return _sl(_("database"), _("data connection"))


def databases_label() -> str:
    """Capitalized plural: "Databases" / "Data connections" """
    return _sl(_("Databases"), _("Data connections"))


def databases_label_lower() -> str:
    """Lower-case plural: "databases" / "data connections" """
    return _sl(_("databases"), _("data connections"))


# ---------------------------------------------------------------------------
# Menu label (includes the word "Connections")
# ---------------------------------------------------------------------------


def database_connections_menu_label() -> str:
    """Menu entry label: "Database Connections" / "Data Connections" """
    return _sl(_("Database Connections"), _("Data Connections"))
