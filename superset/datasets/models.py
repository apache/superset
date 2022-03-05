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
Dataset model.

This model was introduced in SIP-68 (https://github.com/apache/superset/issues/14909),
and represents a "dataset" -- either a physical table or a virtual. In addition to a
dataset, new models for columns, metrics, and tables were also introduced.

These models are not fully implemented, and shouldn't be used yet.
"""

import dataclasses
import logging
from datetime import datetime
from typing import Any, cast, Dict, Hashable, List, NamedTuple, Optional, Union

import pandas as pd
import sqlalchemy as sa
import sqlparse
from flask_appbuilder import Model
from flask_babel import lazy_gettext as _
from jinja2.exceptions import TemplateError
from sqlalchemy import and_, asc, desc, or_, select
from sqlalchemy.orm import relationship
from sqlalchemy.orm.query import Query
from sqlalchemy.sql import column
from sqlalchemy.sql.elements import ColumnElement, Label, literal_column
from sqlalchemy.sql.expression import Select

from superset import is_feature_enabled
from superset.columns.models import Column
from superset.common.db_query_status import QueryStatus
from superset.exceptions import QueryObjectValidationError
from superset.models.helpers import (
    AuditMixinNullable,
    ExtraJSONMixin,
    ImportExportMixin,
    QueryResult,
)
from superset.tables.models import Table
from superset.typing import AdhocMetric, Metric, OrderBy, QueryObjectDict
from superset.utils import core as utils
from superset.utils.core import (
    GenericDataType,
    get_column_name,
    is_adhoc_column,
    QueryObjectFilterClause,
    remove_duplicates,
)

logger = logging.getLogger(__name__)


# todo - move this - duplicated in tables model
class SqlaQuery(NamedTuple):
    applied_template_filters: List[str] = None
    cte: Optional[str] = None
    extra_cache_keys: List[Any] = None
    labels_expected: List[str] = None
    prequeries: List[str] = None
    sqla_query: Select = None


# todo duplicate
class QueryStringExtended(NamedTuple):
    applied_template_filters: Optional[List[str]]
    labels_expected: List[str]
    prequeries: List[str]

    sql: str


column_association_table = sa.Table(
    "sl_dataset_columns",
    Model.metadata,  # pylint: disable=no-member
    sa.Column("dataset_id", sa.ForeignKey("sl_datasets.id")),
    sa.Column("column_id", sa.ForeignKey("sl_columns.id")),
)

table_association_table = sa.Table(
    "sl_dataset_tables",
    Model.metadata,  # pylint: disable=no-member
    sa.Column("dataset_id", sa.ForeignKey("sl_datasets.id")),
    sa.Column("table_id", sa.ForeignKey("sl_tables.id")),
)


class Dataset(Model, AuditMixinNullable, ExtraJSONMixin, ImportExportMixin):
    """
    A table/view in a database.
    """

    __tablename__ = "sl_datasets"
    type = "sl_dataset"

    id = sa.Column(sa.Integer, primary_key=True)

    # A temporary column, used for shadow writing to the new model. Once the ``SqlaTable``
    # model has been deleted this column can be removed.
    sqlatable_id = sa.Column(sa.Integer, nullable=True, unique=True)

    # We use ``sa.Text`` for these attributes because (1) in modern databases the
    # performance is the same as ``VARCHAR``[1] and (2) because some table names can be
    # **really** long (eg, Google Sheets URLs).
    #
    # [1] https://www.postgresql.org/docs/9.1/datatype-character.html
    name = sa.Column(sa.Text)

    expression = sa.Column(sa.Text)

    # n:n relationship
    tables: List[Table] = relationship(
        "Table", secondary=table_association_table)

    # The relationship between datasets and columns is 1:n, but we use a many-to-many
    # association to differentiate between the relationship between tables and columns.
    columns: List[Column] = relationship(
        "Column", secondary=column_association_table, cascade="all, delete"
    )

    # Does the dataset point directly to a ``Table``?
    is_physical = sa.Column(sa.Boolean, default=False)

    # Column is managed externally and should be read-only inside Superset
    is_managed_externally = sa.Column(
        sa.Boolean, nullable=False, default=False)
    external_url = sa.Column(sa.Text, nullable=True)

    # To go into mixin
    is_rls_supported = (
        True  # this is only true for some datasources.. should it be true for all?
    )
    # todo: (eschutho) setting to a very large number
    # because there is no cache
    cache_timeout = 1000000000000

    filter_select_enabled = False

    def get_query_str_extended(self, query_obj: QueryObjectDict) -> QueryStringExtended:
        sqlaq = self.get_sqla_query(**query_obj)
        sql = self.database.compile_sqla_query(sqlaq.sqla_query)
        sql = self._apply_cte(sql, sqlaq.cte)
        sql = sqlparse.format(sql, reindent=True)
        sql = self.mutate_query_from_config(sql)
        return QueryStringExtended(
            applied_template_filters=sqlaq.applied_template_filters,
            labels_expected=sqlaq.labels_expected,
            prequeries=sqlaq.prequeries,
            sql=sql,
        )

    def query(self, qry: SqlaQuery) -> QueryResult:
        qry_start_dttm = datetime.now()
        query_str_ext = self.get_query_str_extended(qry)
        sql = query_str_ext.sql
        status = QueryStatus.SUCCESS
        errors = None
        error_message = None

        def assign_column_label(df: pd.DataFrame) -> Optional[pd.DataFrame]:
            """
            Some engines change the case or generate bespoke column names, either by
            default or due to lack of support for aliasing. This function ensures that
            the column names in the DataFrame correspond to what is expected by
            the viz components.

            Sometimes a query may also contain only order by columns that are not used
            as metrics or groupby columns, but need to present in the SQL `select`,
            filtering by `labels_expected` make sure we only return columns users want.

            :param df: Original DataFrame returned by the engine
            :return: Mutated DataFrame
            """
            labels_expected = query_str_ext.labels_expected
            if df is not None and not df.empty:
                if len(df.columns) < len(labels_expected):
                    raise QueryObjectValidationError(
                        _("Db engine did not return all queried columns")
                    )
                if len(df.columns) > len(labels_expected):
                    df = df.iloc[:, 0: len(labels_expected)]
                df.columns = labels_expected
            return df

        try:
            df = self.database.get_df(
                sql, self.schema, mutator=assign_column_label)
        except Exception as ex:  # pylint: disable=broad-except
            df = pd.DataFrame()
            status = QueryStatus.FAILED
            logger.warning(
                "Query %s on schema %s failed", sql, self.schema, exc_info=True
            )
            db_engine_spec = self.db_engine_spec
            errors = [
                dataclasses.asdict(error) for error in db_engine_spec.extract_errors(ex)
            ]
            error_message = utils.error_msg_from_exception(ex)

        return QueryResult(
            applied_template_filters=query_str_ext.applied_template_filters,
            status=status,
            df=df,
            duration=datetime.now() - qry_start_dttm,
            query=sql,
            errors=errors,
            error_message=error_message,
        )

    def get_sqla_query(  # pylint: disable=too-many-arguments,too-many-locals,too-many-branches,too-many-statements
        self,
        apply_fetch_values_predicate: bool = False,
        columns: Optional[List[Column]] = None,
        extras: Optional[Dict[str, Any]] = None,
        filter: Optional[  # pylint: disable=redefined-builtin
            List[QueryObjectFilterClause]
        ] = None,
        from_dttm: Optional[datetime] = None,
        granularity: Optional[str] = None,
        groupby: Optional[List[Column]] = None,
        inner_from_dttm: Optional[datetime] = None,
        inner_to_dttm: Optional[datetime] = None,
        is_rowcount: bool = False,
        is_timeseries: bool = True,
        metrics: Optional[List[Metric]] = None,
        orderby: Optional[List[OrderBy]] = None,
        order_desc: bool = True,
        to_dttm: Optional[datetime] = None,
        series_columns: Optional[List[Column]] = None,
        series_limit: Optional[int] = None,
        series_limit_metric: Optional[Metric] = None,
        row_limit: Optional[int] = None,
        row_offset: Optional[int] = None,
        timeseries_limit: Optional[int] = None,
        timeseries_limit_metric: Optional[Metric] = None,
    ) -> SqlaQuery:
        """Querying any sqla table from this common interface"""
        if granularity not in self.dttm_cols and granularity is not None:
            granularity = self.main_dttm_col

        extras = extras or {}
        time_grain = extras.get("time_grain_sqla")

        template_kwargs = {
            "columns": columns,
            "from_dttm": from_dttm.isoformat() if from_dttm else None,
            "groupby": groupby,
            "metrics": metrics,
            "row_limit": row_limit,
            "row_offset": row_offset,
            "time_column": granularity,
            "time_grain": time_grain,
            "to_dttm": to_dttm.isoformat() if to_dttm else None,
            "table_columns": [col.column_name for col in self.columns],
            "filter": filter,
        }
        columns = columns or []
        groupby = groupby or []
        series_column_names = utils.get_column_names(series_columns or [])
        # deprecated, to be removed in 2.0
        if is_timeseries and timeseries_limit:
            series_limit = timeseries_limit
        series_limit_metric = series_limit_metric or timeseries_limit_metric
        # template_kwargs.update(self.template_params_dict) #todo
        extra_cache_keys: List[Any] = []
        template_kwargs["extra_cache_keys"] = extra_cache_keys
        removed_filters: List[str] = []
        applied_template_filters: List[str] = []
        template_kwargs["removed_filters"] = removed_filters
        template_kwargs["applied_filters"] = applied_template_filters
        # template_processor = self.get_template_processor(**template_kwargs) #todo
        db_engine_spec = self.db_engine_spec
        prequeries: List[str] = []
        orderby = orderby or []
        need_groupby = bool(metrics is not None or groupby)
        metrics = metrics or []

        # For backward compatibility
        if granularity not in self.dttm_cols and granularity is not None:
            granularity = self.main_dttm_col

        columns_by_name: Dict[str, sa.Table] = {
            col.column_name: col for col in self.columns
        }

        metrics_by_name: Dict[str, Column] = {  # todo column vs metric?
            m.metric_name: m for m in self.metrics
        }

        if not granularity and is_timeseries:
            raise QueryObjectValidationError(
                _(
                    "Datetime column not provided as part table configuration "
                    "and is required by this type of chart"
                )
            )
        if not metrics and not columns and not groupby:
            raise QueryObjectValidationError(_("Empty query?"))

        metrics_exprs: List[ColumnElement] = []
        for metric in metrics:
            if utils.is_adhoc_metric(metric):
                assert isinstance(metric, dict)
                metrics_exprs.append(
                    self.adhoc_metric_to_sqla(metric, columns_by_name))
            elif isinstance(metric, str) and metric in metrics_by_name:
                metrics_exprs.append(metrics_by_name[metric].get_sqla_col())
            else:
                raise QueryObjectValidationError(
                    _("Metric '%(metric)s' does not exist", metric=metric)
                )

        if metrics_exprs:
            main_metric_expr = metrics_exprs[0]
        else:
            main_metric_expr, label = literal_column("COUNT(*)"), "ccount"
            main_metric_expr = self.make_sqla_column_compatible(
                main_metric_expr, label)

        # To ensure correct handling of the ORDER BY labeling we need to reference the
        # metric instance if defined in the SELECT clause.
        # use the key of the ColumnClause for the expected label
        metrics_exprs_by_label = {m.key: m for m in metrics_exprs}
        metrics_exprs_by_expr = {str(m): m for m in metrics_exprs}

        # Since orderby may use adhoc metrics, too; we need to process them first
        orderby_exprs: List[ColumnElement] = []
        for orig_col, ascending in orderby:
            col: Union[AdhocMetric, ColumnElement] = orig_col
            if isinstance(col, dict):
                col = cast(AdhocMetric, col)
                if utils.is_adhoc_metric(col):
                    # add adhoc sort by column to columns_by_name if not exists
                    col = self.adhoc_metric_to_sqla(col, columns_by_name)
                    # if the adhoc metric has been defined before
                    # use the existing instance.
                    col = metrics_exprs_by_expr.get(str(col), col)
                    need_groupby = True
            elif col in columns_by_name:
                col = columns_by_name[col].get_sqla_col()
            elif col in metrics_exprs_by_label:
                col = metrics_exprs_by_label[col]
                need_groupby = True
            elif col in metrics_by_name:
                col = metrics_by_name[col].get_sqla_col()
                need_groupby = True

            if isinstance(col, ColumnElement):
                orderby_exprs.append(col)
            else:
                # Could not convert a column reference to valid ColumnElement
                raise QueryObjectValidationError(
                    _("Unknown column used in orderby: %(col)s", col=orig_col)
                )

        select_exprs: List[Union[Column, Label]] = []
        groupby_all_columns = {}
        groupby_series_columns = {}

        # filter out the pseudo column  __timestamp from columns
        columns = [col for col in columns if col != utils.DTTM_ALIAS]
        dttm_col = columns_by_name.get(granularity) if granularity else None

        if need_groupby:
            # dedup columns while preserving order
            columns = groupby or columns
            for selected in columns:
                if isinstance(selected, str):
                    # if groupby field/expr equals granularity field/expr
                    if selected == granularity:
                        table_col = columns_by_name[selected]
                        outer = table_col.get_timestamp_expression(
                            time_grain=time_grain,
                            label=selected,
                            template_processor=template_processor,
                        )
                    # if groupby field equals a selected column
                    elif selected in columns_by_name:
                        outer = columns_by_name[selected].get_sqla_col()
                    else:
                        outer = literal_column(f"({selected})")
                        outer = self.make_sqla_column_compatible(
                            outer, selected)
                else:
                    outer = self.adhoc_column_to_sqla(
                        col=selected, template_processor=template_processor
                    )
                groupby_all_columns[outer.name] = outer
                if not series_column_names or outer.name in series_column_names:
                    groupby_series_columns[outer.name] = outer
                select_exprs.append(outer)
        elif columns:
            for selected in columns:
                select_exprs.append(
                    columns_by_name[selected].get_sqla_col()
                    if selected in columns_by_name
                    else self.make_sqla_column_compatible(literal_column(selected))
                )
            metrics_exprs = []

        if granularity:
            if granularity not in columns_by_name or not dttm_col:
                raise QueryObjectValidationError(
                    _(
                        'Time column "%(col)s" does not exist in dataset',
                        col=granularity,
                    )
                )
            time_filters = []

            if is_timeseries:
                timestamp = dttm_col.get_timestamp_expression(
                    time_grain=time_grain, template_processor=template_processor
                )
                # always put timestamp as the first column
                select_exprs.insert(0, timestamp)
                groupby_all_columns[timestamp.name] = timestamp

            # Use main dttm column to support index with secondary dttm columns.
            if (
                db_engine_spec.time_secondary_columns
                and self.main_dttm_col in self.dttm_cols
                and self.main_dttm_col != dttm_col.column_name
            ):
                time_filters.append(
                    columns_by_name[self.main_dttm_col].get_time_filter(
                        from_dttm, to_dttm,
                    )
                )
            time_filters.append(dttm_col.get_time_filter(from_dttm, to_dttm))

        # Always remove duplicates by column name, as sometimes `metrics_exprs`
        # can have the same name as a groupby column (e.g. when users use
        # raw columns as custom SQL adhoc metric).
        select_exprs = remove_duplicates(
            select_exprs + metrics_exprs, key=lambda x: x.name
        )

        # Expected output columns
        labels_expected = [c.key for c in select_exprs]

        # Order by columns are "hidden" columns, some databases require them
        # always be present in SELECT if an aggregation function is used
        if not db_engine_spec.allows_hidden_ordeby_agg:
            select_exprs = remove_duplicates(select_exprs + orderby_exprs)

        qry = sa.select(select_exprs)

        tbl, cte = self.get_from_clause(template_processor)

        if groupby_all_columns:
            qry = qry.group_by(*groupby_all_columns.values())

        where_clause_and = []
        having_clause_and = []

        for flt in filter:  # type: ignore
            if not all(flt.get(s) for s in ["col", "op"]):
                continue
            flt_col = flt["col"]
            val = flt.get("val")
            op = flt["op"].upper()
            col_obj: Optional[Column] = None
            sqla_col: Optional[sa.Column] = None
            if flt_col == utils.DTTM_ALIAS and is_timeseries and dttm_col:
                col_obj = dttm_col
            elif is_adhoc_column(flt_col):
                sqla_col = self.adhoc_column_to_sqla(flt_col)
            else:
                col_obj = columns_by_name.get(flt_col)
            filter_grain = flt.get("grain")

            if is_feature_enabled("ENABLE_TEMPLATE_REMOVE_FILTERS"):
                if get_column_name(flt_col) in removed_filters:
                    # Skip generating SQLA filter when the jinja template handles it.
                    continue

            if col_obj or sqla_col is not None:
                if sqla_col is not None:
                    pass
                elif col_obj and filter_grain:
                    sqla_col = col_obj.get_timestamp_expression(
                        time_grain=filter_grain, template_processor=template_processor
                    )
                elif col_obj:
                    sqla_col = col_obj.get_sqla_col()
                col_spec = db_engine_spec.get_column_spec(
                    col_obj.type if col_obj else None
                )
                is_list_target = op in (
                    utils.FilterOperator.IN.value,
                    utils.FilterOperator.NOT_IN.value,
                )
                if col_spec:
                    target_type = col_spec.generic_type
                else:
                    target_type = GenericDataType.STRING
                eq = self.filter_values_handler(
                    values=val,
                    target_column_type=target_type,
                    is_list_target=is_list_target,
                )
                if is_list_target:
                    assert isinstance(eq, (tuple, list))
                    if len(eq) == 0:
                        raise QueryObjectValidationError(
                            _("Filter value list cannot be empty")
                        )
                    if None in eq:
                        eq = [x for x in eq if x is not None]
                        is_null_cond = sqla_col.is_(None)
                        if eq:
                            cond = or_(is_null_cond, sqla_col.in_(eq))
                        else:
                            cond = is_null_cond
                    else:
                        cond = sqla_col.in_(eq)
                    if op == utils.FilterOperator.NOT_IN.value:
                        cond = ~cond
                    where_clause_and.append(cond)
                elif op == utils.FilterOperator.IS_NULL.value:
                    where_clause_and.append(sqla_col.is_(None))
                elif op == utils.FilterOperator.IS_NOT_NULL.value:
                    where_clause_and.append(sqla_col.isnot(None))
                elif op == utils.FilterOperator.IS_TRUE.value:
                    where_clause_and.append(sqla_col.is_(True))
                elif op == utils.FilterOperator.IS_FALSE.value:
                    where_clause_and.append(sqla_col.is_(False))
                else:
                    if eq is None:
                        raise QueryObjectValidationError(
                            _(
                                "Must specify a value for filters "
                                "with comparison operators"
                            )
                        )
                    if op == utils.FilterOperator.EQUALS.value:
                        where_clause_and.append(sqla_col == eq)
                    elif op == utils.FilterOperator.NOT_EQUALS.value:
                        where_clause_and.append(sqla_col != eq)
                    elif op == utils.FilterOperator.GREATER_THAN.value:
                        where_clause_and.append(sqla_col > eq)
                    elif op == utils.FilterOperator.LESS_THAN.value:
                        where_clause_and.append(sqla_col < eq)
                    elif op == utils.FilterOperator.GREATER_THAN_OR_EQUALS.value:
                        where_clause_and.append(sqla_col >= eq)
                    elif op == utils.FilterOperator.LESS_THAN_OR_EQUALS.value:
                        where_clause_and.append(sqla_col <= eq)
                    elif op == utils.FilterOperator.LIKE.value:
                        where_clause_and.append(sqla_col.like(eq))
                    elif op == utils.FilterOperator.ILIKE.value:
                        where_clause_and.append(sqla_col.ilike(eq))
                    else:
                        raise QueryObjectValidationError(
                            _("Invalid filter operation type: %(op)s", op=op)
                        )
        if is_feature_enabled("ROW_LEVEL_SECURITY"):
            where_clause_and += self._get_sqla_row_level_filters(
                template_processor)
        if extras:
            where = extras.get("where")
            if where:
                try:
                    where = template_processor.process_template(where)
                except TemplateError as ex:
                    raise QueryObjectValidationError(
                        _(
                            "Error in jinja expression in WHERE clause: %(msg)s",
                            msg=ex.message,
                        )
                    ) from ex
                where_clause_and += [self.text(f"({where})")]
            having = extras.get("having")
            if having:
                try:
                    having = template_processor.process_template(having)
                except TemplateError as ex:
                    raise QueryObjectValidationError(
                        _(
                            "Error in jinja expression in HAVING clause: %(msg)s",
                            msg=ex.message,
                        )
                    ) from ex
                having_clause_and += [self.text(f"({having})")]
        if apply_fetch_values_predicate and self.fetch_values_predicate:
            qry = qry.where(self.get_fetch_values_predicate())
        if granularity:
            qry = qry.where(and_(*(time_filters + where_clause_and)))
        else:
            qry = qry.where(and_(*where_clause_and))
        qry = qry.having(and_(*having_clause_and))

        self.make_orderby_compatible(select_exprs, orderby_exprs)

        for col, (orig_col, ascending) in zip(orderby_exprs, orderby):
            if not db_engine_spec.allows_alias_in_orderby and isinstance(col, Label):
                # if engine does not allow using SELECT alias in ORDER BY
                # revert to the underlying column
                col = col.element

            if (
                db_engine_spec.allows_alias_in_select
                and db_engine_spec.allows_hidden_cc_in_orderby
                and col.name in [select_col.name for select_col in select_exprs]
            ):
                col = literal_column(col.name)
            direction = asc if ascending else desc
            qry = qry.order_by(direction(col))

        if row_limit:
            qry = qry.limit(row_limit)
        if row_offset:
            qry = qry.offset(row_offset)

        if series_limit and groupby_series_columns:
            if db_engine_spec.allows_joins and db_engine_spec.allows_subqueries:
                # some sql dialects require for order by expressions
                # to also be in the select clause -- others, e.g. vertica,
                # require a unique inner alias
                inner_main_metric_expr = self.make_sqla_column_compatible(
                    main_metric_expr, "mme_inner__"
                )
                inner_groupby_exprs = []
                inner_select_exprs = []
                for gby_name, gby_obj in groupby_series_columns.items():
                    label = get_column_name(gby_name)
                    inner = self.make_sqla_column_compatible(
                        gby_obj, gby_name + "__")
                    inner_groupby_exprs.append(inner)
                    inner_select_exprs.append(inner)

                inner_select_exprs += [inner_main_metric_expr]
                subq = select(inner_select_exprs).select_from(tbl)
                inner_time_filter = []

                if dttm_col and not db_engine_spec.time_groupby_inline:
                    inner_time_filter = [
                        dttm_col.get_time_filter(
                            inner_from_dttm or from_dttm, inner_to_dttm or to_dttm,
                        )
                    ]
                subq = subq.where(
                    and_(*(where_clause_and + inner_time_filter)))
                subq = subq.group_by(*inner_groupby_exprs)

                ob = inner_main_metric_expr
                if series_limit_metric:
                    ob = self._get_series_orderby(
                        series_limit_metric, metrics_by_name, columns_by_name
                    )
                direction = desc if order_desc else asc
                subq = subq.order_by(direction(ob))
                subq = subq.limit(series_limit)

                on_clause = []
                for gby_name, gby_obj in groupby_series_columns.items():
                    # in this case the column name, not the alias, needs to be
                    # conditionally mutated, as it refers to the column alias in
                    # the inner query
                    col_name = db_engine_spec.make_label_compatible(
                        gby_name + "__")
                    on_clause.append(gby_obj == column(col_name))

                tbl = tbl.join(subq.alias(), and_(*on_clause))
            else:
                if series_limit_metric:
                    orderby = [
                        (
                            self._get_series_orderby(
                                series_limit_metric, metrics_by_name, columns_by_name,
                            ),
                            not order_desc,
                        )
                    ]

                # run prequery to get top groups
                prequery_obj = {
                    "is_timeseries": False,
                    "row_limit": series_limit,
                    "metrics": metrics,
                    "granularity": granularity,
                    "groupby": groupby,
                    "from_dttm": inner_from_dttm or from_dttm,
                    "to_dttm": inner_to_dttm or to_dttm,
                    "filter": filter,
                    "orderby": orderby,
                    "extras": extras,
                    "columns": columns,
                    "order_desc": True,
                }

                result = self.query(prequery_obj)
                prequeries.append(result.query)
                dimensions = [
                    c
                    for c in result.df.columns
                    if c not in metrics and c in groupby_series_columns
                ]
                top_groups = self._get_top_groups(
                    result.df, dimensions, groupby_series_columns, columns_by_name
                )
                qry = qry.where(top_groups)

        qry = qry.select_from(tbl)

        if is_rowcount:
            if not db_engine_spec.allows_subqueries:
                raise QueryObjectValidationError(
                    _("Database does not support subqueries")
                )
            label = "rowcount"
            col = self.make_sqla_column_compatible(
                literal_column("COUNT(*)"), label)
            qry = select([col]).select_from(qry.alias("rowcount_qry"))
            labels_expected = [label]

        return SqlaQuery(
            applied_template_filters=applied_template_filters,
            cte=cte,
            extra_cache_keys=extra_cache_keys,
            labels_expected=labels_expected,
            sqla_query=qry,
            prequeries=prequeries,
        )

    @staticmethod
    def default_query(qry: Query) -> Query:
        return qry

    @property
    def perm(self) -> Optional[str]:
        return "todo"

    def get_perm(self) -> Optional[str]:
        return self.perm

    @property
    def schema_perm(self) -> Optional[str]:
        return "todo"

    def get_schema_perm(self) -> Optional[str]:
        return self.schema_perm

    @property
    def schema(self) -> Optional[str]:
        return None  # todo

    @property
    def explore_url(self) -> Optional[str]:
        return None  # todo

    @property
    def uid(self) -> str:  # from BaseDatasource
        """Unique id across datasource types"""
        return f"{self.id}__{self.type}"

    def get_extra_cache_keys(  # pylint: disable=no-self-use
        self, query_obj: QueryObjectDict  # pylint: disable=unused-argument
    ) -> List[Hashable]:
        """If a datasource needs to provide additional keys for calculation of
        cache keys, those can be provided via this method

        :param query_obj: The dict representation of a query object
        :return: list of keys
        """
        return []

    @property
    def column_names(self) -> List[str]:  # from BaseDatasource (modified)
        return sorted([c.column_name for c in self.columns], key=lambda x: x or "")

    def query_class(
        mapper=None, session=None
    ):  # todo this should be extending form the sqlalchemy model
        return SqlaQuery

    @property
    def data(self) -> Dict[str, Any]:  # todo
        data_ = {"id": self.id, "columns": self.columns}
        if self.is_physical:
            data_["granularity_sqla"] = []
            data_["time_grain_sqla"] = []
            data_["main_dttm_col"] = []
            data_["fetch_values_predicate"] = []
            data_["template_params"] = []
            data_["is_sqllab_view"] = []
            data_["health_check_message"] = []
            data_["extra"] = []
        return data_

    @property
    def owners_data(self) -> Dict[str, Any]:  # todo
        return {}

    @property
    def dttm_cols(self) -> List[str]:
        l = [c.column_name for c in self.columns if c.is_dttm]
        if self.main_dttm_col and self.main_dttm_col not in l:
            l.append(self.main_dttm_col)
        return l

    @property
    def main_dttm_col(self) -> str:  # todo - this should be a real column
        return "ds"
