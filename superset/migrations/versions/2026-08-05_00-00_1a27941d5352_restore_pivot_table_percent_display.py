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
"""restore pivot table percent display from orphaned aggregateFunction

PR #41184 (SIP-216) removed the Pivot Table's per-table "Aggregation
function" control (form_data field ``aggregateFunction``), including its
"Sum/Count as Fraction of Total/Rows/Columns" options, in favor of
DB-computed totals. Per that PR's own UPDATING.md note, saved charts that
had ``aggregateFunction`` set were deliberately left as-is rather than
migrated: "Saved charts that set aggregateFunction will ignore it; no
migration is required." The field has been fully unused dead weight in
``params``/``query_context`` ever since.

PR #42761 reintroduces the fraction-display feature as a new, standalone
``showValuesAs`` field. This migration derives ``showValuesAs`` from any
still-present ``aggregateFunction`` fraction value on ``pivot_table_v2``
charts, so a chart that had this display configured before #41184 shipped
gets it back automatically instead of requiring someone to reopen every
affected chart and reselect it by hand. Charts whose ``aggregateFunction``
was a non-fraction value (Sum, Average, Count, ...) are left untouched --
those were never broken by the removal and are out of scope here.

Only the three "Sum as Fraction of ..." values are migrated. The three
"Count as Fraction of ..." values are deliberately excluded: they divided a
*record count* by a record count, whereas the new ``showValuesAs`` modes
divide the metric's own *value* by that value at the requested scope (see
``cellValue``/``fractionOf`` in
``superset-frontend/.../plugin-chart-pivot-table/src/react-pivottable/utilities.ts``).
Mapping "Count as Fraction" onto a value-based percent would silently change
what a saved chart displays -- e.g. a 50/50 split by record count could
become a 10/90 split by value -- rather than restore it, so those are left
as un-migrated dead data, same as Sum/Average/Count.

Only the ``params``/``query_context`` snapshot stored on the slice is
patched. The stored ``query_context`` is a cache mainly used for reports/
alerts; interactive Explore/dashboard rendering always rebuilds the query
fresh from the current form_data, so this has no effect there. A report or
alert that renders a migrated chart before it is next opened in Explore
will not reflect the restored percent display in its ``query_context``
until then, but will not error -- ``showValuesAs`` is purely a display
transform for the additive metrics used by the vast majority of pivot
tables.

Revision ID: 1a27941d5352
Revises: 16755d4ca4ae
Create Date: 2026-08-05 00:00:00.000000

"""

from alembic import op
from sqlalchemy import Column, Integer, String, Text
from sqlalchemy.orm import declarative_base

from superset import db
from superset.migrations.shared.utils import paginated_update
from superset.utils import json

# revision identifiers, used by Alembic.
revision = "1a27941d5352"
down_revision = "16755d4ca4ae"

Base = declarative_base()

_VIZ_TYPE = "pivot_table_v2"
_OLD_FIELD = "aggregateFunction"
_NEW_FIELD = "showValuesAs"

# Old `aggregateFunction` fraction values -> new `showValuesAs` enum values
# (see ShowValuesAsEnum in superset-frontend/.../plugin-chart-pivot-table/src/types.ts).
# "Count as Fraction of ..." values are intentionally NOT mapped here -- see the
# module docstring for why translating them would change what the chart shows
# rather than restore it.
_FRACTION_MAPPING = {
    "Sum as Fraction of Total": "percent_total",
    "Sum as Fraction of Rows": "percent_row",
    "Sum as Fraction of Columns": "percent_col",
}


class Slice(Base):  # type: ignore
    __tablename__ = "slices"

    id = Column(Integer, primary_key=True)
    viz_type = Column(String(250))
    params = Column(Text)
    query_context = Column(Text)


def _migrate_params(slc: Slice) -> bool:
    """Derive showValuesAs from an orphaned fraction aggregateFunction in
    params. Returns True if params changed."""
    if not slc.params:
        return False
    try:
        params = json.loads(slc.params)
    except Exception:
        return False
    if not isinstance(params, dict):
        # A slice's params can be malformed (e.g. `[]`/`null`) from unrelated
        # historical bugs; skip rather than let `.get()` raise and abort the
        # whole migration partway through `paginated_update`'s batches.
        return False

    old_value = params.get(_OLD_FIELD)
    new_value = _FRACTION_MAPPING.get(old_value)
    if not new_value or _NEW_FIELD in params:
        return False

    params[_NEW_FIELD] = new_value
    del params[_OLD_FIELD]
    slc.params = json.dumps(params)
    return True


def _migrate_query_context_form_data(slc: Slice) -> bool:
    """Mirror the same derivation into query_context.form_data, best-effort,
    so a saved query_context snapshot stays consistent with params. Returns
    True if query_context changed."""
    if not slc.query_context:
        return False
    try:
        qc = json.loads(slc.query_context)
    except Exception:
        return False
    if not isinstance(qc, dict):
        return False

    form_data = qc.get("form_data")
    if not isinstance(form_data, dict):
        return False

    old_value = form_data.get(_OLD_FIELD)
    new_value = _FRACTION_MAPPING.get(old_value)
    if not new_value or _NEW_FIELD in form_data:
        return False

    form_data[_NEW_FIELD] = new_value
    del form_data[_OLD_FIELD]
    slc.query_context = json.dumps(qc)
    return True


def upgrade() -> None:
    bind = op.get_bind()
    session = db.Session(bind=bind)

    query = session.query(Slice).filter(Slice.viz_type == _VIZ_TYPE)
    for slc in paginated_update(
        query,
        lambda current, total: print(f"    {current}/{total}", end="\r"),
    ):
        _migrate_params(slc)
        _migrate_query_context_form_data(slc)

    session.commit()


def downgrade() -> None:
    # `showValuesAs` is a purely additive field: older code that doesn't know
    # about it ignores it, exactly as `aggregateFunction` itself was left as
    # harmless orphaned data by #41184 rather than migrated away. There is
    # nothing to restore -- the original `aggregateFunction` value is gone by
    # design (see module docstring), and a chart may have since had
    # `showValuesAs` set directly through the new control rather than by this
    # migration, so guessing a reverse mapping would risk clobbering a real
    # user choice.
    pass
