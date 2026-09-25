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
"""tag pivot tables with a restored aggregateFunction for review

PR #41184 (SIP-216) removed the Pivot Table's per-table "Aggregation
function" control (form_data field ``aggregateFunction``) and left it as
orphaned, ignored dead data on any chart that had it set -- per that PR's
own UPDATING.md note, no migration was done at the time.

A later change restores the same control as "result aggregation": a second
aggregation pass over a metric's own grouped results, computed correctly
this time (see docs/sip -- not repeating the pre-SIP-216 bug of
re-aggregating already-displayed values). It deliberately reuses the exact
same form_data field name and the exact same value spellings the old
control used, so no value needs to change for a saved chart to pick it back
up -- the moment that code ships, any chart with e.g.
``aggregateFunction: "Median"`` already sitting in ``params`` starts
computing its totals with the new, correct "Median" result aggregation
again, automatically.

That is by design and does not need admin review to be *safe*, but a
chart's totals silently changing shape on upgrade is still worth a
customer-facing heads-up, not silence. This migration does not touch
``aggregateFunction`` or any other value -- there is nothing to migrate --
it only:

1. Tags every ``pivot_table_v2`` chart whose ``aggregateFunction`` is one of
   the pre-SIP-216 values (i.e. would now activate result aggregation) with
   a ``LEGACY_AGGREGATION_TAG`` custom tag, so affected charts are
   queryable and the frontend can surface a one-time "these totals were
   restored, please validate" notice (removed automatically the first time
   the chart is opened and accepted, or saved).
2. Clears the chart's cached ``query_context`` snapshot. That cache
   predates the feature entirely (it was built under the old,
   GROUPING-SETS-only query shape) and would otherwise serve a stale,
   pre-restoration result to a report or alert until the chart is next
   opened and re-saved in Explore -- same caveat #42761's migration
   accepted for its own, narrower fraction-value migration. Clearing it
   (rather than trying to patch it) forces a correct rebuild on next use
   instead of risking a subtly wrong hand-patched cache.

Revision ID: 141b8ada7731
Revises: 95d8a99c822e
Create Date: 2026-09-25 00:00:00.000000

"""

from alembic import op
from sqlalchemy import Column, Enum, Integer, String, Text
from sqlalchemy.orm import declarative_base

from superset import db
from superset.migrations.shared.utils import paginated_update
from superset.tags.models import ObjectType, TagType
from superset.utils import json

# revision identifiers, used by Alembic.
revision = "141b8ada7731"
down_revision = "95d8a99c822e"

Base = declarative_base()

_VIZ_TYPE = "pivot_table_v2"
_FIELD = "aggregateFunction"

# Name of the custom tag applied to an affected chart. Kept in sync with
# `LEGACY_AGGREGATION_TAG` in
# superset-frontend/src/explore/components/LegacyAggregationAlert.tsx,
# which reads and clears it.
LEGACY_AGGREGATION_TAG = "legacy-pivot-aggregation-restored"

# The pre-SIP-216 "Aggregation function" values -- kept in sync with
# RESULT_AGGREGATIONS in
# superset-frontend/.../plugin-chart-pivot-table/src/plugin/resultAggregation.ts.
# Any chart whose orphaned `aggregateFunction` is one of these will start
# computing its totals with that result aggregation again, automatically,
# the moment the restoring code ships -- this migration only tags it.
_LEGACY_AGGREGATE_FUNCTIONS = frozenset(
    {
        "Count",
        "Count Unique Values",
        "List Unique Values",
        "Sum",
        "Average",
        "Median",
        "Sample Variance",
        "Sample Standard Deviation",
        "Minimum",
        "Maximum",
        "First",
        "Last",
        "Sum as Fraction of Total",
        "Sum as Fraction of Rows",
        "Sum as Fraction of Columns",
        "Count as Fraction of Total",
        "Count as Fraction of Rows",
        "Count as Fraction of Columns",
    }
)


class Slice(Base):  # type: ignore
    __tablename__ = "slices"

    id = Column(Integer, primary_key=True)
    viz_type = Column(String(250))
    params = Column(Text)
    query_context = Column(Text)


class Tag(Base):  # type: ignore
    __tablename__ = "tag"

    id = Column(Integer, primary_key=True)
    name = Column(String(250), unique=True)
    # TagType.custom -- an explicit tag, same category the tag REST API and
    # the existing tag-management UI already read/write/delete, so no new
    # frontend plumbing is needed to show or clear it.
    type = Column(Enum(TagType))


class TaggedObject(Base):  # type: ignore
    __tablename__ = "tagged_object"

    id = Column(Integer, primary_key=True)
    tag_id = Column(Integer)
    object_id = Column(Integer)
    object_type = Column(Enum(ObjectType))


def _has_legacy_aggregate_function(slc: Slice) -> bool:
    if not slc.params:
        return False
    try:
        params = json.loads(slc.params)
    except Exception:  # pylint: disable=broad-except
        # A slice's params can be malformed (e.g. `[]`/`null`) from unrelated
        # historical bugs; skip rather than let `.get()` raise and abort the
        # whole migration partway through `paginated_update`'s batches.
        return False
    if not isinstance(params, dict):
        return False
    return params.get(_FIELD) in _LEGACY_AGGREGATE_FUNCTIONS


def upgrade() -> None:
    bind = op.get_bind()
    session = db.Session(bind=bind)

    tag = session.query(Tag).filter_by(name=LEGACY_AGGREGATION_TAG).one_or_none()
    if tag is None:
        tag = Tag(name=LEGACY_AGGREGATION_TAG, type=TagType.custom)
        session.add(tag)
        session.flush()  # populate tag.id for the TaggedObject rows below

    query = session.query(Slice).filter(Slice.viz_type == _VIZ_TYPE)
    for slc in paginated_update(
        query,
        lambda current, total: print(f"    {current}/{total}", end="\r"),
    ):
        if not _has_legacy_aggregate_function(slc):
            continue

        already_tagged = (
            session.query(TaggedObject)
            .filter_by(tag_id=tag.id, object_id=slc.id, object_type=ObjectType.chart)
            .one_or_none()
        )
        if already_tagged is None:
            session.add(
                TaggedObject(
                    tag_id=tag.id, object_id=slc.id, object_type=ObjectType.chart
                )
            )

        # Clear the cached query_context snapshot: it predates result
        # aggregation entirely and would otherwise serve a stale,
        # pre-restoration shape to a report or alert until the chart is
        # next opened and saved in Explore. A slice with no query_context
        # is a normal, already-handled state (Explore rebuilds it fresh),
        # not an error condition.
        slc.query_context = None

    session.commit()


def downgrade() -> None:
    # The tag and the query_context clear are both purely additive/neutral:
    # an untagged chart behaves identically to one this migration never
    # touched, and a cleared query_context is rebuilt fresh on next render
    # regardless. There is no `aggregateFunction` value to restore -- this
    # migration never changed one -- so there is nothing to reverse.
    pass
