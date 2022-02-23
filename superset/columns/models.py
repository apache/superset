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
Column model.

This model was introduced in SIP-68 (https://github.com/apache/superset/issues/14909),
and represents a "column" in a table or dataset. In addition to a column, new models for
tables, metrics, and datasets were also introduced.

These models are not fully implemented, and shouldn't be used yet.
"""

import sqlalchemy as sa
from flask_appbuilder import Model

from superset.models.helpers import (
    AuditMixinNullable,
    ExtraJSONMixin,
    ImportExportMixin,
)


class Column(
    Model, AuditMixinNullable, ExtraJSONMixin, ImportExportMixin,
):
    """
    A "column".

    The definition of column here is overloaded: it can represent a physical column in a
    database relation (table or view); a computed/derived column on a dataset; or an
    aggregation expression representing a metric.
    """

    __tablename__ = "sl_columns"

    id = sa.Column(sa.Integer, primary_key=True)

    # We use ``sa.Text`` for these attributes because (1) in modern databases the
    # performance is the same as ``VARCHAR``[1] and (2) because some table names can be
    # **really** long (eg, Google Sheets URLs).
    #
    # [1] https://www.postgresql.org/docs/9.1/datatype-character.html
    name = sa.Column(sa.Text)
    type = sa.Column(sa.Text)

    # Columns are defined by expressions. For tables, these are the actual columns names,
    # and should match the ``name`` attribute. For datasets, these can be any valid SQL
    # expression. If the SQL expression is an aggregation the column is a metric,
    # otherwise it's a computed column.
    expression = sa.Column(sa.Text)

    # Does the expression point directly to a physical column?
    is_physical = sa.Column(sa.Boolean, default=True)

    # Additional metadata describing the column.
    description = sa.Column(sa.Text)
    warning_text = sa.Column(sa.Text)
    unit = sa.Column(sa.Text)

    # Is this a time column? Useful for plotting time series.
    is_temporal = sa.Column(sa.Boolean, default=False)

    # Is this a spatial column? This could be leveraged in the future for spatial
    # visualizations.
    is_spatial = sa.Column(sa.Boolean, default=False)

    # Is this column a partition? Useful for scheduling queries and previewing the latest
    # data.
    is_partition = sa.Column(sa.Boolean, default=False)

    # Is this column an aggregation (metric)?
    is_aggregation = sa.Column(sa.Boolean, default=False)

    # Assuming the column is an aggregation, is it additive? Useful for determining which
    # aggregations can be done on the metric. Eg, ``COUNT(DISTINCT user_id)`` is not
    # additive, so it shouldn't be used in a ``SUM``.
    is_additive = sa.Column(sa.Boolean, default=False)

    # Is an increase desired? Useful for displaying the results of A/B tests, or setting
    # up alerts. Eg, this is true for "revenue", but false for "latency".
    is_increase_desired = sa.Column(sa.Boolean, default=True)

    # Column is managed externally and should be read-only inside Superset
    is_managed_externally = sa.Column(sa.Boolean, nullable=False, default=False)
    external_url = sa.Column(sa.Text, nullable=True)
