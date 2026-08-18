# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License. You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
import copy
import logging
from typing import Any

from flask import current_app
from sqlalchemy import and_, Column, Integer, String, Text
from sqlalchemy.orm import declarative_base, Session

from superset.constants import TimeGrain
from superset.migrations.shared.utils import paginated_update, try_load_json
from superset.utils import json
from superset.utils.date_parser import get_since_until

logger = logging.getLogger("alembic.env")

Base = declarative_base()


class Slice(Base):  # type: ignore
    __tablename__ = "slices"

    id = Column(Integer, primary_key=True)
    slice_name = Column(String(250))
    viz_type = Column(String(250))
    params = Column(Text)
    query_context = Column(Text)


FORM_DATA_BAK_FIELD_NAME = "form_data_bak"
QUERIES_BAK_FIELD_NAME = "queries_bak"

# Sentinel wrapper key used only when a stored query_context is missing its
# "queries" key (an atypical/hand-edited context). It lets downgrade_slice
# tell "no queries key on the original context" apart from "there was no
# stored context at all" -- both of which would otherwise back up as a bare
# `None` -- without changing the shape of a normal, list-valued backup, so
# backups written by older releases still downgrade the same way.
FULL_CONTEXT_BAK_KEY = "__query_context_bak__"


class MigrateViz:
    remove_keys: set[str] = set()
    rename_keys: dict[str, str] = {}
    source_viz_type: str
    target_viz_type: str
    has_x_axis_control: bool = False

    def __init__(self, form_data: str) -> None:
        self.data = try_load_json(form_data)

    def _pre_action(self) -> None:
        """Some actions before migrate"""

    def _migrate(self) -> None:
        if self.data.get("viz_type") != self.source_viz_type:
            return

        if "viz_type" in self.data:
            self.data["viz_type"] = self.target_viz_type

        # Sometimes visualizations have same keys in the source form_data and rename_keys  # noqa: E501
        # We need to remove them from data to allow the migration to work properly with rename_keys  # noqa: E501
        for source_key, target_key in self.rename_keys.items():
            if source_key in self.data and target_key in self.data:
                self.data.pop(target_key)

        rv_data = {}
        for key, value in self.data.items():
            if key in self.rename_keys and self.rename_keys[key] in rv_data:
                raise ValueError("Duplicate key in target viz")

            if key in self.rename_keys:
                rv_data[self.rename_keys[key]] = value
                continue

            if key in self.remove_keys:
                continue

            rv_data[key] = value

        self._migrate_temporal_filter(rv_data)

        self.data = rv_data

    def _post_action(self) -> None:
        """Some actions after migrate"""

    def _migrate_temporal_filter(self, rv_data: dict[str, Any]) -> None:
        """Adds a temporal filter."""
        granularity_sqla = rv_data.pop("granularity_sqla", None)
        time_range = rv_data.pop("time_range", None) or current_app.config.get(
            "DEFAULT_TIME_FILTER"
        )

        if not granularity_sqla:
            return

        if self.has_x_axis_control:
            rv_data["x_axis"] = granularity_sqla
            rv_data["time_grain_sqla"] = rv_data.get("time_grain_sqla") or TimeGrain.DAY

        temporal_filter = {
            "clause": "WHERE",
            "subject": granularity_sqla,
            "operator": "TEMPORAL_RANGE",
            "comparator": time_range,
            "expressionType": "SIMPLE",
        }

        if isinstance(granularity_sqla, dict):
            since, until = get_since_until(time_range=time_range)
            if not since and not until:
                temporal_filter = {}
            else:
                temporal_filter["comparator"] = None
                temporal_filter["expressionType"] = "SQL"
                temporal_filter["subject"] = granularity_sqla["label"]

                start_date = since.isoformat() if since else None
                end_date = until.isoformat() if until else None
                if start_date and end_date:
                    temporal_filter["sqlExpression"] = (
                        f"{granularity_sqla['sqlExpression']} >= '{start_date}' AND "
                        f"{granularity_sqla['sqlExpression']} < '{end_date}'"
                    )
                elif start_date:
                    temporal_filter["sqlExpression"] = (
                        f"{granularity_sqla['sqlExpression']} >= '{start_date}'"
                    )
                elif end_date:
                    temporal_filter["sqlExpression"] = (
                        f"{granularity_sqla['sqlExpression']} < '{end_date}'"
                    )

        rv_data["adhoc_filters"] = rv_data.get("adhoc_filters") or []
        if temporal_filter:
            rv_data["adhoc_filters"].append(temporal_filter)

    @classmethod
    def upgrade_slice(cls, slc: Slice) -> None:
        try:
            clz = cls(slc.params)
            form_data_bak = copy.deepcopy(clz.data)

            clz._pre_action()
            clz._migrate()
            clz._post_action()

            # viz_type depends on the migration and should be set after its execution
            # because a source viz can be mapped to different target viz types
            slc.viz_type = clz.target_viz_type

            backup: Any | dict[str, Any] = {FORM_DATA_BAK_FIELD_NAME: form_data_bak}

            query_context = try_load_json(slc.query_context)
            queries_bak = None

            if isinstance(query_context, dict) and query_context:
                # A stored query_context is expected to be an object carrying
                # a non-null "queries" list, but an atypical/malformed one
                # (e.g. hand-edited via the API) missing that key, or with
                # "queries": null, must not raise here: viz_type was already
                # flipped above, so an uncaught exception at this point
                # would leave the slice half-migrated (new viz_type, but
                # stale params/query_context in the old shape). Back up the
                # whole context in that case so downgrade can restore it
                # verbatim instead of losing it (see FULL_CONTEXT_BAK_KEY).
                # Both cases must share this sentinel path rather than
                # backing up a bare `None` -- that value is indistinguishable
                # from "no context was ever stored", which would make
                # downgrade discard the slice's original datasource/form_data
                # instead of restoring this context.
                if "queries" in query_context and query_context["queries"] is not None:
                    queries_bak = copy.deepcopy(query_context["queries"])
                else:
                    queries_bak = {FULL_CONTEXT_BAK_KEY: copy.deepcopy(query_context)}

                if "form_data" in query_context:
                    query_context["form_data"] = clz.data

                queries = clz._build_query()["queries"]
                query_context["queries"] = queries
            elif query_context:
                # A parseable but non-object query_context (e.g. a bare
                # number or a JSON list -- both accepted by the schema
                # validator) can't carry "queries"/"form_data" keys; back it
                # up wholesale like the cases above and rebuild a fresh one,
                # rather than raising on membership-testing a non-dict (which
                # would leave the slice half-migrated, per the note above).
                queries_bak = {FULL_CONTEXT_BAK_KEY: copy.deepcopy(query_context)}
                query_context = clz._build_query()
            else:
                query_context = clz._build_query()

            slc.query_context = json.dumps(query_context)
            backup[QUERIES_BAK_FIELD_NAME] = queries_bak
            slc.params = json.dumps({**clz.data, **backup})

        except Exception as e:
            logger.warning("Failed to migrate slice %s: %s", slc.id, e)

    @classmethod
    def downgrade_slice(cls, slc: Slice) -> None:
        try:
            form_data = try_load_json(slc.params)
            form_data_bak = form_data.get(FORM_DATA_BAK_FIELD_NAME, {})
            if (
                "viz_type" in form_data_bak
                and form_data_bak["viz_type"] == cls.source_viz_type
            ):
                slc.params = json.dumps(form_data_bak)
                slc.viz_type = form_data_bak.get("viz_type")
                query_context = try_load_json(slc.query_context)
                queries_bak = form_data.get(QUERIES_BAK_FIELD_NAME)
                if (
                    isinstance(queries_bak, dict)
                    and FULL_CONTEXT_BAK_KEY in queries_bak
                ):
                    # The original context had no "queries" key, so it was
                    # backed up wholesale on upgrade -- restore it verbatim
                    # rather than patching "queries" onto the upgraded
                    # context.
                    slc.query_context = json.dumps(queries_bak[FULL_CONTEXT_BAK_KEY])
                elif queries_bak is not None:
                    # A falsy-but-present backup (e.g. an original
                    # "queries": []) is still a real context to restore, not
                    # the "there was nothing to restore" case below --
                    # treating it as None would discard the slice's original
                    # datasource and form_data.
                    query_context["queries"] = queries_bak
                    if "form_data" in query_context:
                        query_context["form_data"] = form_data_bak
                    slc.query_context = json.dumps(query_context)
                else:
                    slc.query_context = None

        except Exception as e:
            logger.warning("Failed to downgrade slice %s: %s", slc.id, e)

    @classmethod
    def upgrade(cls, session: Session) -> None:
        slices = session.query(Slice).filter(Slice.viz_type == cls.source_viz_type)
        for slc in paginated_update(
            slices,
            lambda current, total: logger.info("Upgraded %s/%s charts", current, total),
        ):
            cls.upgrade_slice(slc)

    @classmethod
    def downgrade(cls, session: Session) -> None:
        # This SQL-level filter is intentionally coarse: several MigrateViz
        # subclasses can share one target_viz_type (e.g. MigrateLineChart and
        # MigrateCompareChart both migrate onto echarts_timeseries_line), so
        # it will also match slices another subclass upgraded. downgrade_slice
        # does the precise per-row check (form_data_bak["viz_type"] ==
        # cls.source_viz_type) so this class's downgrade only reverts the
        # slices it upgraded, not every slice currently at the same target.
        slices = session.query(Slice).filter(
            and_(
                Slice.viz_type == cls.target_viz_type,
                Slice.params.like(f"%{FORM_DATA_BAK_FIELD_NAME}%"),
            )
        )
        for slc in paginated_update(
            slices,
            lambda current, total: logger.info(
                "Downgraded %s/%s charts", current, total
            ),
        ):
            cls.downgrade_slice(slc)

    def _build_query(self) -> Any | dict[str, Any]:
        """Builds a query based on the form data."""
