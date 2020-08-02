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
# pylint: skip-file
import json
import logging
import re
from collections import OrderedDict
from copy import deepcopy
from datetime import datetime, timedelta
from distutils.version import LooseVersion
from multiprocessing.pool import ThreadPool
from typing import Any, cast, Dict, Iterable, List, Optional, Set, Tuple, Union

import pandas as pd
import sqlalchemy as sa
from dateutil.parser import parse as dparse
from flask import escape, Markup
from flask_appbuilder import Model
from flask_appbuilder.models.decorators import renders
from flask_appbuilder.security.sqla.models import User
from flask_babel import lazy_gettext as _
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Table,
    Text,
    UniqueConstraint,
)
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import backref, relationship
from sqlalchemy.sql import expression
from sqlalchemy_utils import EncryptedType

from superset import conf, db, is_feature_enabled, security_manager
from superset.connectors.base.models import BaseColumn, BaseDatasource, BaseMetric
from superset.constants import NULL_STRING
from superset.exceptions import SupersetException
from superset.models.core import Database
from superset.models.helpers import AuditMixinNullable, ImportMixin, QueryResult
from superset.typing import FilterValues, Granularity, Metric, QueryObjectDict
from superset.utils import core as utils, import_datasource

try:
    from pydruid.client import PyDruid
    from pydruid.utils.aggregators import count
    from pydruid.utils.dimensions import (
        MapLookupExtraction,
        RegexExtraction,
        RegisteredLookupExtraction,
        TimeFormatExtraction,
    )
    from pydruid.utils.filters import Bound, Dimension, Filter
    from pydruid.utils.having import Aggregation, Having
    from pydruid.utils.postaggregator import (
        Const,
        Field,
        HyperUniqueCardinality,
        Postaggregator,
        Quantile,
        Quantiles,
    )
    import requests
except ImportError:
    pass

try:
    from superset.utils.core import DimSelector, DTTM_ALIAS, FilterOperator, flasher
except ImportError:
    pass

IS_SIP_38 = is_feature_enabled("SIP_38_VIZ_REARCHITECTURE")
DRUID_TZ = conf.get("DRUID_TZ")
POST_AGG_TYPE = "postagg"
metadata = Model.metadata  # pylint: disable=no-member
logger = logging.getLogger(__name__)

try:
    # Postaggregator might not have been imported.
    class JavascriptPostAggregator(Postaggregator):
        def __init__(self, name: str, field_names: List[str], function: str) -> None:
            self.post_aggregator = {
                "type": "javascript",
                "fieldNames": field_names,
                "name": name,
                "function": function,
            }
            self.name = name

    class CustomPostAggregator(Postaggregator):
        """A way to allow users to specify completely custom PostAggregators"""

        def __init__(self, name: str, post_aggregator: Dict[str, Any]) -> None:
            self.name = name
            self.post_aggregator = post_aggregator


except NameError:
    pass

# Function wrapper because bound methods cannot
# be passed to processes
def _fetch_metadata_for(datasource: "DruidDatasource") -> Optional[Dict[str, Any]]:
    return datasource.latest_metadata()


class DruidCluster(Model, AuditMixinNullable, ImportMixin):

    """ORM object referencing the Druid clusters"""

    __tablename__ = "clusters"
    type = "druid"

    id = Column(Integer, primary_key=True)
    verbose_name = Column(String(250), unique=True)
    # short unique name, used in permissions
    cluster_name = Column(String(250), unique=True, nullable=False)
    broker_host = Column(String(255))
    broker_port = Column(Integer, default=8082)
    broker_endpoint = Column(String(255), default="druid/v2")
    metadata_last_refreshed = Column(DateTime)
    cache_timeout = Column(Integer)
    broker_user = Column(String(255))
    broker_pass = Column(EncryptedType(String(255), conf.get("SECRET_KEY")))

    export_fields = [
        "cluster_name",
        "broker_host",
        "broker_port",
        "broker_endpoint",
        "cache_timeout",
        "broker_user",
    ]
    update_from_object_fields = export_fields
    export_children = ["datasources"]

    def __repr__(self) -> str:
        return self.verbose_name if self.verbose_name else self.cluster_name

    def __html__(self) -> str:
        return self.__repr__()

    @property
    def data(self) -> Dict[str, Any]:
        return {"id": self.id, "name": self.cluster_name, "backend": "druid"}

    @staticmethod
    def get_base_url(host: str, port: int) -> str:
        if not re.match("http(s)?://", host):
            host = "http://" + host

        url = "{0}:{1}".format(host, port) if port else host
        return url

    def get_base_broker_url(self) -> str:
        base_url = self.get_base_url(self.broker_host, self.broker_port)
        return f"{base_url}/{self.broker_endpoint}"

    def get_pydruid_client(self) -> "PyDruid":
        cli = PyDruid(
            self.get_base_url(self.broker_host, self.broker_port), self.broker_endpoint
        )
        if self.broker_user and self.broker_pass:
            cli.set_basic_auth_credentials(self.broker_user, self.broker_pass)
        return cli

    def get_datasources(self) -> List[str]:
        endpoint = self.get_base_broker_url() + "/datasources"
        auth = requests.auth.HTTPBasicAuth(self.broker_user, self.broker_pass)
        return json.loads(requests.get(endpoint, auth=auth).text)

    def get_druid_version(self) -> str:
        endpoint = self.get_base_url(self.broker_host, self.broker_port) + "/status"
        auth = requests.auth.HTTPBasicAuth(self.broker_user, self.broker_pass)
        return json.loads(requests.get(endpoint, auth=auth).text)["version"]

    @property  # type: ignore
    @utils.memoized
    def druid_version(self) -> str:
        return self.get_druid_version()

    def refresh_datasources(
        self,
        datasource_name: Optional[str] = None,
        merge_flag: bool = True,
        refresh_all: bool = True,
    ) -> None:
        """Refresh metadata of all datasources in the cluster
        If ``datasource_name`` is specified, only that datasource is updated
        """
        ds_list = self.get_datasources()
        denylist = conf.get("DRUID_DATA_SOURCE_DENYLIST", [])
        ds_refresh: List[str] = []
        if not datasource_name:
            ds_refresh = list(filter(lambda ds: ds not in denylist, ds_list))
        elif datasource_name not in denylist and datasource_name in ds_list:
            ds_refresh.append(datasource_name)
        else:
            return
        self.refresh(ds_refresh, merge_flag, refresh_all)

    def refresh(
        self, datasource_names: List[str], merge_flag: bool, refresh_all: bool
    ) -> None:
        """
        Fetches metadata for the specified datasources and
        merges to the Superset database
        """
        ds_list = (
            db.session.query(DruidDatasource)
            .filter(DruidDatasource.cluster_id == self.id)
            .filter(DruidDatasource.datasource_name.in_(datasource_names))
        )
        ds_map = {ds.name: ds for ds in ds_list}
        for ds_name in datasource_names:
            datasource = ds_map.get(ds_name, None)
            if not datasource:
                datasource = DruidDatasource(datasource_name=ds_name)
                with db.session.no_autoflush:
                    db.session.add(datasource)
                flasher(_("Adding new datasource [{}]").format(ds_name), "success")
                ds_map[ds_name] = datasource
            elif refresh_all:
                flasher(_("Refreshing datasource [{}]").format(ds_name), "info")
            else:
                del ds_map[ds_name]
                continue
            datasource.cluster = self
            datasource.merge_flag = merge_flag
        db.session.flush()

        # Prepare multithreaded executation
        pool = ThreadPool()
        ds_refresh = list(ds_map.values())
        metadata = pool.map(_fetch_metadata_for, ds_refresh)
        pool.close()
        pool.join()

        for i in range(0, len(ds_refresh)):
            datasource = ds_refresh[i]
            cols = metadata[i]
            if cols:
                col_objs_list = (
                    db.session.query(DruidColumn)
                    .filter(DruidColumn.datasource_id == datasource.id)
                    .filter(DruidColumn.column_name.in_(cols.keys()))
                )
                col_objs = {col.column_name: col for col in col_objs_list}
                for col in cols:
                    if col == "__time":  # skip the time column
                        continue
                    col_obj = col_objs.get(col)
                    if not col_obj:
                        col_obj = DruidColumn(
                            datasource_id=datasource.id, column_name=col
                        )
                        with db.session.no_autoflush:
                            db.session.add(col_obj)
                    col_obj.type = cols[col]["type"]
                    col_obj.datasource = datasource
                    if col_obj.type == "STRING":
                        col_obj.groupby = True
                        col_obj.filterable = True
                datasource.refresh_metrics()
        db.session.commit()

    @hybrid_property
    def perm(self) -> str:
        return f"[{self.cluster_name}].(id:{self.id})"

    @perm.expression  # type: ignore
    def perm(cls) -> str:  # pylint: disable=no-self-argument
        return "[" + cls.cluster_name + "].(id:" + expression.cast(cls.id, String) + ")"

    def get_perm(self) -> str:
        return self.perm  # type: ignore

    @property
    def name(self) -> str:
        return self.verbose_name or self.cluster_name

    @property
    def unique_name(self) -> str:
        return self.verbose_name or self.cluster_name


sa.event.listen(DruidCluster, "after_insert", security_manager.set_perm)
sa.event.listen(DruidCluster, "after_update", security_manager.set_perm)


class DruidColumn(Model, BaseColumn):
    """ORM model for storing Druid datasource column metadata"""

    __tablename__ = "columns"
    __table_args__ = (UniqueConstraint("column_name", "datasource_id"),)

    datasource_id = Column(Integer, ForeignKey("datasources.id"))
    # Setting enable_typechecks=False disables polymorphic inheritance.
    datasource = relationship(
        "DruidDatasource",
        backref=backref("columns", cascade="all, delete-orphan"),
        enable_typechecks=False,
    )
    dimension_spec_json = Column(Text)

    export_fields = [
        "datasource_id",
        "column_name",
        "is_active",
        "type",
        "groupby",
        "filterable",
        "description",
        "dimension_spec_json",
        "verbose_name",
    ]
    update_from_object_fields = export_fields
    export_parent = "datasource"

    def __repr__(self) -> str:
        return self.column_name or str(self.id)

    @property
    def expression(self) -> str:
        return self.dimension_spec_json

    @property
    def dimension_spec(self) -> Optional[Dict[str, Any]]:
        if self.dimension_spec_json:
            return json.loads(self.dimension_spec_json)
        return None

    def get_metrics(self) -> Dict[str, "DruidMetric"]:
        metrics = {
            "count": DruidMetric(
                metric_name="count",
                verbose_name="COUNT(*)",
                metric_type="count",
                json=json.dumps({"type": "count", "name": "count"}),
            )
        }
        return metrics

    def refresh_metrics(self) -> None:
        """Refresh metrics based on the column metadata"""
        metrics = self.get_metrics()
        dbmetrics = (
            db.session.query(DruidMetric)
            .filter(DruidMetric.datasource_id == self.datasource_id)
            .filter(DruidMetric.metric_name.in_(metrics.keys()))
        )
        dbmetrics = {metric.metric_name: metric for metric in dbmetrics}
        for metric in metrics.values():
            dbmetric = dbmetrics.get(metric.metric_name)
            if dbmetric:
                for attr in ["json", "metric_type"]:
                    setattr(dbmetric, attr, getattr(metric, attr))
            else:
                with db.session.no_autoflush:
                    metric.datasource_id = self.datasource_id
                    db.session.add(metric)

    @classmethod
    def import_obj(cls, i_column: "DruidColumn") -> "DruidColumn":
        def lookup_obj(lookup_column: DruidColumn) -> Optional[DruidColumn]:
            return (
                db.session.query(DruidColumn)
                .filter(
                    DruidColumn.datasource_id == lookup_column.datasource_id,
                    DruidColumn.column_name == lookup_column.column_name,
                )
                .first()
            )

        return import_datasource.import_simple_obj(i_column, lookup_obj)


class DruidMetric(Model, BaseMetric):

    """ORM object referencing Druid metrics for a datasource"""

    __tablename__ = "metrics"
    __table_args__ = (UniqueConstraint("metric_name", "datasource_id"),)
    datasource_id = Column(Integer, ForeignKey("datasources.id"))

    # Setting enable_typechecks=False disables polymorphic inheritance.
    datasource = relationship(
        "DruidDatasource",
        backref=backref("metrics", cascade="all, delete-orphan"),
        enable_typechecks=False,
    )
    json = Column(Text, nullable=False)

    export_fields = [
        "metric_name",
        "verbose_name",
        "metric_type",
        "datasource_id",
        "json",
        "description",
        "d3format",
        "warning_text",
    ]
    update_from_object_fields = export_fields
    export_parent = "datasource"

    @property
    def expression(self) -> Column:
        return self.json

    @property
    def json_obj(self) -> Dict[str, Any]:
        try:
            obj = json.loads(self.json)
        except Exception:
            obj = {}
        return obj

    @property
    def perm(self) -> Optional[str]:
        return (
            ("{parent_name}.[{obj.metric_name}](id:{obj.id})").format(
                obj=self, parent_name=self.datasource.full_name
            )
            if self.datasource
            else None
        )

    def get_perm(self) -> Optional[str]:
        return self.perm

    @classmethod
    def import_obj(cls, i_metric: "DruidMetric") -> "DruidMetric":
        def lookup_obj(lookup_metric: DruidMetric) -> Optional[DruidMetric]:
            return (
                db.session.query(DruidMetric)
                .filter(
                    DruidMetric.datasource_id == lookup_metric.datasource_id,
                    DruidMetric.metric_name == lookup_metric.metric_name,
                )
                .first()
            )

        return import_datasource.import_simple_obj(i_metric, lookup_obj)


druiddatasource_user = Table(
    "druiddatasource_user",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("user_id", Integer, ForeignKey("ab_user.id")),
    Column("datasource_id", Integer, ForeignKey("datasources.id")),
)


class DruidDatasource(Model, BaseDatasource):

    """ORM object referencing Druid datasources (tables)"""

    __tablename__ = "datasources"
    __table_args__ = (UniqueConstraint("datasource_name", "cluster_id"),)

    type = "druid"
    query_language = "json"
    cluster_class = DruidCluster
    metric_class = DruidMetric
    column_class = DruidColumn
    owner_class = security_manager.user_model

    baselink = "druiddatasourcemodelview"

    # Columns
    datasource_name = Column(String(255), nullable=False)
    is_hidden = Column(Boolean, default=False)
    filter_select_enabled = Column(Boolean, default=True)  # override default
    fetch_values_from = Column(String(100))
    cluster_id = Column(Integer, ForeignKey("clusters.id"), nullable=False)
    cluster = relationship(
        "DruidCluster", backref="datasources", foreign_keys=[cluster_id]
    )
    owners = relationship(
        owner_class, secondary=druiddatasource_user, backref="druiddatasources"
    )

    export_fields = [
        "datasource_name",
        "is_hidden",
        "description",
        "default_endpoint",
        "cluster_id",
        "offset",
        "cache_timeout",
        "params",
        "filter_select_enabled",
    ]
    update_from_object_fields = export_fields

    export_parent = "cluster"
    export_children = ["columns", "metrics"]

    @property
    def cluster_name(self) -> str:
        cluster = (
            self.cluster
            or db.session.query(DruidCluster).filter_by(id=self.cluster_id).one()
        )
        return cluster.cluster_name

    @property
    def database(self) -> DruidCluster:
        return self.cluster

    @property
    def connection(self) -> str:
        return str(self.database)

    @property
    def num_cols(self) -> List[str]:
        return [c.column_name for c in self.columns if c.is_numeric]

    @property
    def name(self) -> str:
        return self.datasource_name

    @property
    def datasource_type(self) -> str:
        return self.type

    @property
    def schema(self) -> Optional[str]:
        ds_name = self.datasource_name or ""
        name_pieces = ds_name.split(".")
        if len(name_pieces) > 1:
            return name_pieces[0]
        else:
            return None

    def get_schema_perm(self) -> Optional[str]:
        """Returns schema permission if present, cluster one otherwise."""
        return security_manager.get_schema_perm(self.cluster, self.schema)

    def get_perm(self) -> str:
        return ("[{obj.cluster_name}].[{obj.datasource_name}]" "(id:{obj.id})").format(
            obj=self
        )

    def update_from_object(self, obj: Dict[str, Any]) -> None:
        raise NotImplementedError()

    @property
    def link(self) -> Markup:
        name = escape(self.datasource_name)
        return Markup(f'<a href="{self.url}">{name}</a>')

    @property
    def full_name(self) -> str:
        return utils.get_datasource_full_name(self.cluster_name, self.datasource_name)

    @property
    def time_column_grains(self) -> Dict[str, List[str]]:
        return {
            "time_columns": [
                "all",
                "5 seconds",
                "30 seconds",
                "1 minute",
                "5 minutes",
                "30 minutes",
                "1 hour",
                "6 hour",
                "1 day",
                "7 days",
                "week",
                "week_starting_sunday",
                "week_ending_saturday",
                "month",
                "quarter",
                "year",
            ],
            "time_grains": ["now"],
        }

    def __repr__(self) -> str:
        return self.datasource_name

    @renders("datasource_name")
    def datasource_link(self) -> str:
        url = f"/superset/explore/{self.type}/{self.id}/"
        name = escape(self.datasource_name)
        return Markup(f'<a href="{url}">{name}</a>')

    def get_metric_obj(self, metric_name: str) -> Dict[str, Any]:
        return [m.json_obj for m in self.metrics if m.metric_name == metric_name][0]

    @classmethod
    def import_obj(
        cls, i_datasource: "DruidDatasource", import_time: Optional[int] = None
    ) -> int:
        """Imports the datasource from the object to the database.

         Metrics and columns and datasource will be overridden if exists.
         This function can be used to import/export dashboards between multiple
         superset instances. Audit metadata isn't copies over.
        """

        def lookup_datasource(d: DruidDatasource) -> Optional[DruidDatasource]:
            return (
                db.session.query(DruidDatasource)
                .filter(
                    DruidDatasource.datasource_name == d.datasource_name,
                    DruidDatasource.cluster_id == d.cluster_id,
                )
                .first()
            )

        def lookup_cluster(d: DruidDatasource) -> Optional[DruidCluster]:
            return db.session.query(DruidCluster).filter_by(id=d.cluster_id).first()

        return import_datasource.import_datasource(
            i_datasource, lookup_cluster, lookup_datasource, import_time
        )

    def latest_metadata(self) -> Optional[Dict[str, Any]]:
        """Returns segment metadata from the latest segment"""
        logger.info("Syncing datasource [{}]".format(self.datasource_name))
        client = self.cluster.get_pydruid_client()
        try:
            results = client.time_boundary(datasource=self.datasource_name)
        except IOError:
            results = None
        if results:
            max_time = results[0]["result"]["maxTime"]
            max_time = dparse(max_time)
        else:
            max_time = datetime.now()
        # Query segmentMetadata for 7 days back. However, due to a bug,
        # we need to set this interval to more than 1 day ago to exclude
        # realtime segments, which triggered a bug (fixed in druid 0.8.2).
        # https://groups.google.com/forum/#!topic/druid-user/gVCqqspHqOQ
        lbound = (max_time - timedelta(days=7)).isoformat()
        if LooseVersion(self.cluster.druid_version) < LooseVersion("0.8.2"):
            rbound = (max_time - timedelta(1)).isoformat()
        else:
            rbound = max_time.isoformat()
        segment_metadata = None
        try:
            segment_metadata = client.segment_metadata(
                datasource=self.datasource_name,
                intervals=lbound + "/" + rbound,
                merge=self.merge_flag,
                analysisTypes=[],
            )
        except Exception as ex:
            logger.warning("Failed first attempt to get latest segment")
            logger.exception(ex)
        if not segment_metadata:
            # if no segments in the past 7 days, look at all segments
            lbound = datetime(1901, 1, 1).isoformat()[:10]
            if LooseVersion(self.cluster.druid_version) < LooseVersion("0.8.2"):
                rbound = datetime.now().isoformat()
            else:
                rbound = datetime(2050, 1, 1).isoformat()[:10]
            try:
                segment_metadata = client.segment_metadata(
                    datasource=self.datasource_name,
                    intervals=lbound + "/" + rbound,
                    merge=self.merge_flag,
                    analysisTypes=[],
                )
            except Exception as ex:
                logger.warning("Failed 2nd attempt to get latest segment")
                logger.exception(ex)
        if segment_metadata:
            return segment_metadata[-1]["columns"]
        return None

    def refresh_metrics(self) -> None:
        for col in self.columns:
            col.refresh_metrics()

    @classmethod
    def sync_to_db_from_config(
        cls,
        druid_config: Dict[str, Any],
        user: User,
        cluster: DruidCluster,
        refresh: bool = True,
    ) -> None:
        """Merges the ds config from druid_config into one stored in the db."""
        datasource = (
            db.session.query(cls)
            .filter_by(datasource_name=druid_config["name"])
            .first()
        )
        # Create a new datasource.
        if not datasource:
            datasource = cls(
                datasource_name=druid_config["name"],
                cluster=cluster,
                owners=[user],
                changed_by_fk=user.id,
                created_by_fk=user.id,
            )
            db.session.add(datasource)
        elif not refresh:
            return

        dimensions = druid_config["dimensions"]
        col_objs = (
            db.session.query(DruidColumn)
            .filter(DruidColumn.datasource_id == datasource.id)
            .filter(DruidColumn.column_name.in_(dimensions))
        )
        col_objs = {col.column_name: col for col in col_objs}
        for dim in dimensions:
            col_obj = col_objs.get(dim, None)
            if not col_obj:
                col_obj = DruidColumn(
                    datasource_id=datasource.id,
                    column_name=dim,
                    groupby=True,
                    filterable=True,
                    # TODO: fetch type from Hive.
                    type="STRING",
                    datasource=datasource,
                )
                db.session.add(col_obj)
        # Import Druid metrics
        metric_objs = (
            db.session.query(DruidMetric)
            .filter(DruidMetric.datasource_id == datasource.id)
            .filter(
                DruidMetric.metric_name.in_(
                    spec["name"] for spec in druid_config["metrics_spec"]
                )
            )
        )
        metric_objs = {metric.metric_name: metric for metric in metric_objs}
        for metric_spec in druid_config["metrics_spec"]:
            metric_name = metric_spec["name"]
            metric_type = metric_spec["type"]
            metric_json = json.dumps(metric_spec)

            if metric_type == "count":
                metric_type = "longSum"
                metric_json = json.dumps(
                    {"type": "longSum", "name": metric_name, "fieldName": metric_name}
                )

            metric_obj = metric_objs.get(metric_name, None)
            if not metric_obj:
                metric_obj = DruidMetric(
                    metric_name=metric_name,
                    metric_type=metric_type,
                    verbose_name="%s(%s)" % (metric_type, metric_name),
                    datasource=datasource,
                    json=metric_json,
                    description=(
                        "Imported from the airolap config dir for %s"
                        % druid_config["name"]
                    ),
                )
                db.session.add(metric_obj)
        db.session.commit()

    @staticmethod
    def time_offset(granularity: Granularity) -> int:
        if granularity == "week_ending_saturday":
            return 6 * 24 * 3600 * 1000  # 6 days
        return 0

    @classmethod
    def get_datasource_by_name(
        cls, datasource_name: str, schema: str, database_name: str
    ) -> Optional["DruidDatasource"]:
        query = (
            db.session.query(cls)
            .join(DruidCluster)
            .filter(cls.datasource_name == datasource_name)
            .filter(DruidCluster.cluster_name == database_name)
        )
        return query.first()

    # uses https://en.wikipedia.org/wiki/ISO_8601
    # http://druid.io/docs/0.8.0/querying/granularities.html
    # TODO: pass origin from the UI
    @staticmethod
    def granularity(
        period_name: str, timezone: Optional[str] = None, origin: Optional[str] = None
    ) -> Union[Dict[str, str], str]:
        if not period_name or period_name == "all":
            return "all"
        iso_8601_dict = {
            "5 seconds": "PT5S",
            "30 seconds": "PT30S",
            "1 minute": "PT1M",
            "5 minutes": "PT5M",
            "30 minutes": "PT30M",
            "1 hour": "PT1H",
            "6 hour": "PT6H",
            "one day": "P1D",
            "1 day": "P1D",
            "7 days": "P7D",
            "week": "P1W",
            "week_starting_sunday": "P1W",
            "week_ending_saturday": "P1W",
            "month": "P1M",
            "quarter": "P3M",
            "year": "P1Y",
        }

        granularity = {"type": "period"}
        if timezone:
            granularity["timeZone"] = timezone

        if origin:
            dttm = utils.parse_human_datetime(origin)
            assert dttm
            granularity["origin"] = dttm.isoformat()

        if period_name in iso_8601_dict:
            granularity["period"] = iso_8601_dict[period_name]
            if period_name in ("week_ending_saturday", "week_starting_sunday"):
                # use Sunday as start of the week
                granularity["origin"] = "2016-01-03T00:00:00"
        elif not isinstance(period_name, str):
            granularity["type"] = "duration"
            granularity["duration"] = period_name
        elif period_name.startswith("P"):
            # identify if the string is the iso_8601 period
            granularity["period"] = period_name
        else:
            granularity["type"] = "duration"
            granularity["duration"] = (
                utils.parse_human_timedelta(period_name).total_seconds()  # type: ignore
                * 1000
            )
        return granularity

    @staticmethod
    def get_post_agg(mconf: Dict[str, Any]) -> "Postaggregator":
        """
        For a metric specified as `postagg` returns the
        kind of post aggregation for pydruid.
        """
        if mconf.get("type") == "javascript":
            return JavascriptPostAggregator(
                name=mconf.get("name", ""),
                field_names=mconf.get("fieldNames", []),
                function=mconf.get("function", ""),
            )
        elif mconf.get("type") == "quantile":
            return Quantile(mconf.get("name", ""), mconf.get("probability", ""))
        elif mconf.get("type") == "quantiles":
            return Quantiles(mconf.get("name", ""), mconf.get("probabilities", ""))
        elif mconf.get("type") == "fieldAccess":
            return Field(mconf.get("name"))
        elif mconf.get("type") == "constant":
            return Const(mconf.get("value"), output_name=mconf.get("name", ""))
        elif mconf.get("type") == "hyperUniqueCardinality":
            return HyperUniqueCardinality(mconf.get("name"))
        elif mconf.get("type") == "arithmetic":
            return Postaggregator(
                mconf.get("fn", "/"), mconf.get("fields", []), mconf.get("name", "")
            )
        else:
            return CustomPostAggregator(mconf.get("name", ""), mconf)

    @staticmethod
    def find_postaggs_for(
        postagg_names: Set[str], metrics_dict: Dict[str, DruidMetric]
    ) -> List[DruidMetric]:
        """Return a list of metrics that are post aggregations"""
        postagg_metrics = [
            metrics_dict[name]
            for name in postagg_names
            if metrics_dict[name].metric_type == POST_AGG_TYPE
        ]
        # Remove post aggregations that were found
        for postagg in postagg_metrics:
            postagg_names.remove(postagg.metric_name)
        return postagg_metrics

    @staticmethod
    def recursive_get_fields(_conf: Dict[str, Any]) -> List[str]:
        _type = _conf.get("type")
        _field = _conf.get("field")
        _fields = _conf.get("fields")
        field_names = []
        if _type in ["fieldAccess", "hyperUniqueCardinality", "quantile", "quantiles"]:
            field_names.append(_conf.get("fieldName", ""))
        if _field:
            field_names += DruidDatasource.recursive_get_fields(_field)
        if _fields:
            for _f in _fields:
                field_names += DruidDatasource.recursive_get_fields(_f)
        return list(set(field_names))

    @staticmethod
    def resolve_postagg(
        postagg: DruidMetric,
        post_aggs: Dict[str, Any],
        agg_names: Set[str],
        visited_postaggs: Set[str],
        metrics_dict: Dict[str, DruidMetric],
    ) -> None:
        mconf = postagg.json_obj
        required_fields = set(
            DruidDatasource.recursive_get_fields(mconf) + mconf.get("fieldNames", [])
        )
        # Check if the fields are already in aggs
        # or is a previous postagg
        required_fields = set(
            field
            for field in required_fields
            if field not in visited_postaggs and field not in agg_names
        )
        # First try to find postaggs that match
        if len(required_fields) > 0:
            missing_postaggs = DruidDatasource.find_postaggs_for(
                required_fields, metrics_dict
            )
            for missing_metric in required_fields:
                agg_names.add(missing_metric)
            for missing_postagg in missing_postaggs:
                # Add to visited first to avoid infinite recursion
                # if post aggregations are cyclicly dependent
                visited_postaggs.add(missing_postagg.metric_name)
            for missing_postagg in missing_postaggs:
                DruidDatasource.resolve_postagg(
                    missing_postagg,
                    post_aggs,
                    agg_names,
                    visited_postaggs,
                    metrics_dict,
                )
        post_aggs[postagg.metric_name] = DruidDatasource.get_post_agg(postagg.json_obj)

    @staticmethod
    def metrics_and_post_aggs(
        metrics: List[Metric], metrics_dict: Dict[str, DruidMetric]
    ) -> Tuple["OrderedDict[str, Any]", "OrderedDict[str, Any]"]:
        # Separate metrics into those that are aggregations
        # and those that are post aggregations
        saved_agg_names = set()
        adhoc_agg_configs = []
        postagg_names = []
        for metric in metrics:
            if isinstance(metric, dict) and utils.is_adhoc_metric(metric):
                adhoc_agg_configs.append(metric)
            elif isinstance(metric, str):
                if metrics_dict[metric].metric_type != POST_AGG_TYPE:
                    saved_agg_names.add(metric)
                else:
                    postagg_names.append(metric)
        # Create the post aggregations, maintain order since postaggs
        # may depend on previous ones
        post_aggs: "OrderedDict[str, Postaggregator]" = OrderedDict()
        visited_postaggs = set()
        for postagg_name in postagg_names:
            postagg = metrics_dict[postagg_name]
            visited_postaggs.add(postagg_name)
            DruidDatasource.resolve_postagg(
                postagg, post_aggs, saved_agg_names, visited_postaggs, metrics_dict
            )
        aggs = DruidDatasource.get_aggregations(
            metrics_dict, saved_agg_names, adhoc_agg_configs
        )
        return aggs, post_aggs

    def values_for_column(self, column_name: str, limit: int = 10000) -> List[Any]:
        """Retrieve some values for the given column"""
        logger.info(
            "Getting values for columns [{}] limited to [{}]".format(column_name, limit)
        )
        # TODO: Use Lexicographic TopNMetricSpec once supported by PyDruid
        if self.fetch_values_from:
            from_dttm = utils.parse_human_datetime(self.fetch_values_from)
            assert from_dttm
        else:
            from_dttm = datetime(1970, 1, 1)

        qry = dict(
            datasource=self.datasource_name,
            granularity="all",
            intervals=from_dttm.isoformat() + "/" + datetime.now().isoformat(),
            aggregations=dict(count=count("count")),
            dimension=column_name,
            metric="count",
            threshold=limit,
        )

        client = self.cluster.get_pydruid_client()
        client.topn(**qry)
        df = client.export_pandas()
        return df[column_name].to_list()

    def get_query_str(
        self,
        query_obj: QueryObjectDict,
        phase: int = 1,
        client: Optional["PyDruid"] = None,
    ) -> str:
        return self.run_query(client=client, phase=phase, **query_obj)

    def _add_filter_from_pre_query_data(
        self, df: pd.DataFrame, dimensions: List[Any], dim_filter: "Filter"
    ) -> "Filter":
        ret = dim_filter
        if not df.empty:
            new_filters = []
            for unused, row in df.iterrows():
                fields = []
                for dim in dimensions:
                    f = None
                    # Check if this dimension uses an extraction function
                    # If so, create the appropriate pydruid extraction object
                    if isinstance(dim, dict) and "extractionFn" in dim:
                        (col, extraction_fn) = DruidDatasource._create_extraction_fn(
                            dim
                        )
                        dim_val = dim["outputName"]
                        f = Filter(
                            dimension=col,
                            value=row[dim_val],
                            extraction_function=extraction_fn,
                        )
                    elif isinstance(dim, dict):
                        dim_val = dim["outputName"]
                        if dim_val:
                            f = Dimension(dim_val) == row[dim_val]
                    else:
                        f = Dimension(dim) == row[dim]
                    if f:
                        fields.append(f)
                if len(fields) > 1:
                    term = Filter(type="and", fields=fields)
                    new_filters.append(term)
                elif fields:
                    new_filters.append(fields[0])
            if new_filters:
                ff = Filter(type="or", fields=new_filters)
                if not dim_filter:
                    ret = ff
                else:
                    ret = Filter(type="and", fields=[ff, dim_filter])
        return ret

    @staticmethod
    def druid_type_from_adhoc_metric(adhoc_metric: Dict[str, Any]) -> str:
        column_type = adhoc_metric["column"]["type"].lower()
        aggregate = adhoc_metric["aggregate"].lower()

        if aggregate == "count":
            return "count"
        if aggregate == "count_distinct":
            return "hyperUnique" if column_type == "hyperunique" else "cardinality"
        else:
            return column_type + aggregate.capitalize()

    @staticmethod
    def get_aggregations(
        metrics_dict: Dict[str, Any],
        saved_metrics: Set[str],
        adhoc_metrics: Optional[List[Dict[str, Any]]] = None,
    ) -> "OrderedDict[str, Any]":
        """
            Returns a dictionary of aggregation metric names to aggregation json objects

            :param metrics_dict: dictionary of all the metrics
            :param saved_metrics: list of saved metric names
            :param adhoc_metrics: list of adhoc metric names
            :raise SupersetException: if one or more metric names are not aggregations
        """
        if not adhoc_metrics:
            adhoc_metrics = []
        aggregations = OrderedDict()
        invalid_metric_names = []
        for metric_name in saved_metrics:
            if metric_name in metrics_dict:
                metric = metrics_dict[metric_name]
                if metric.metric_type == POST_AGG_TYPE:
                    invalid_metric_names.append(metric_name)
                else:
                    aggregations[metric_name] = metric.json_obj
            else:
                invalid_metric_names.append(metric_name)
        if len(invalid_metric_names) > 0:
            raise SupersetException(
                _("Metric(s) {} must be aggregations.").format(invalid_metric_names)
            )
        for adhoc_metric in adhoc_metrics:
            aggregations[adhoc_metric["label"]] = {
                "fieldName": adhoc_metric["column"]["column_name"],
                "fieldNames": [adhoc_metric["column"]["column_name"]],
                "type": DruidDatasource.druid_type_from_adhoc_metric(adhoc_metric),
                "name": adhoc_metric["label"],
            }
        return aggregations

    def get_dimensions(
        self, columns: List[str], columns_dict: Dict[str, DruidColumn]
    ) -> List[Union[str, Dict[str, Any]]]:
        dimensions = []
        columns = [col for col in columns if col in columns_dict]
        for column_name in columns:
            col = columns_dict.get(column_name)
            dim_spec = col.dimension_spec if col else None
            dimensions.append(dim_spec or column_name)
        return dimensions

    def intervals_from_dttms(self, from_dttm: datetime, to_dttm: datetime) -> str:
        # Couldn't find a way to just not filter on time...
        from_dttm = from_dttm or datetime(1901, 1, 1)
        to_dttm = to_dttm or datetime(2101, 1, 1)

        # add tzinfo to native datetime with config
        from_dttm = from_dttm.replace(tzinfo=DRUID_TZ)
        to_dttm = to_dttm.replace(tzinfo=DRUID_TZ)
        return "{}/{}".format(
            from_dttm.isoformat() if from_dttm else "",
            to_dttm.isoformat() if to_dttm else "",
        )

    @staticmethod
    def _dimensions_to_values(
        dimensions: List[Union[Dict[str, str], str]]
    ) -> List[Union[Dict[str, str], str]]:
        """
        Replace dimensions specs with their `dimension`
        values, and ignore those without
        """
        values: List[Union[Dict[str, str], str]] = []
        for dimension in dimensions:
            if isinstance(dimension, dict):
                if "extractionFn" in dimension:
                    values.append(dimension)
                elif "dimension" in dimension:
                    values.append(dimension["dimension"])
            else:
                values.append(dimension)

        return values

    @staticmethod
    def sanitize_metric_object(metric: Metric) -> None:
        """
        Update a metric with the correct type if necessary.
        :param dict metric: The metric to sanitize
        """
        if (
            utils.is_adhoc_metric(metric)
            and metric["column"]["type"].upper() == "FLOAT"  # type: ignore
        ):
            metric["column"]["type"] = "DOUBLE"  # type: ignore

    def run_query(  # druid
        self,
        metrics: List[Metric],
        granularity: str,
        from_dttm: datetime,
        to_dttm: datetime,
        columns: Optional[List[str]] = None,
        groupby: Optional[List[str]] = None,
        filter: Optional[List[Dict[str, Any]]] = None,
        is_timeseries: Optional[bool] = True,
        timeseries_limit: Optional[int] = None,
        timeseries_limit_metric: Optional[Metric] = None,
        row_limit: Optional[int] = None,
        row_offset: Optional[int] = None,
        inner_from_dttm: Optional[datetime] = None,
        inner_to_dttm: Optional[datetime] = None,
        orderby: Optional[Any] = None,
        extras: Optional[Dict[str, Any]] = None,
        phase: int = 2,
        client: Optional["PyDruid"] = None,
        order_desc: bool = True,
    ) -> str:
        """Runs a query against Druid and returns a dataframe.
        """
        # TODO refactor into using a TBD Query object
        client = client or self.cluster.get_pydruid_client()
        row_limit = row_limit or conf.get("ROW_LIMIT")
        if row_offset:
            raise SupersetException("Offset not implemented for Druid connector")

        if not is_timeseries:
            granularity = "all"

        if granularity == "all":
            phase = 1
        inner_from_dttm = inner_from_dttm or from_dttm
        inner_to_dttm = inner_to_dttm or to_dttm

        timezone = from_dttm.replace(tzinfo=DRUID_TZ).tzname() if from_dttm else None

        query_str = ""
        metrics_dict = {m.metric_name: m for m in self.metrics}
        columns_dict = {c.column_name: c for c in self.columns}

        if self.cluster and LooseVersion(
            self.cluster.get_druid_version()
        ) < LooseVersion("0.11.0"):
            for metric in metrics:
                self.sanitize_metric_object(metric)
            if timeseries_limit_metric:
                self.sanitize_metric_object(timeseries_limit_metric)

        aggregations, post_aggs = DruidDatasource.metrics_and_post_aggs(
            metrics, metrics_dict
        )

        # the dimensions list with dimensionSpecs expanded
        columns_ = columns if IS_SIP_38 else groupby
        dimensions = self.get_dimensions(columns_, columns_dict) if columns_ else []

        extras = extras or {}
        qry = dict(
            datasource=self.datasource_name,
            dimensions=dimensions,
            aggregations=aggregations,
            granularity=DruidDatasource.granularity(
                granularity, timezone=timezone, origin=extras.get("druid_time_origin")
            ),
            post_aggregations=post_aggs,
            intervals=self.intervals_from_dttms(from_dttm, to_dttm),
        )

        if is_timeseries:
            qry["context"] = dict(skipEmptyBuckets=True)

        filters = (
            DruidDatasource.get_filters(filter, self.num_cols, columns_dict)
            if filter
            else None
        )
        if filters:
            qry["filter"] = filters

        if "having_druid" in extras:
            having_filters = self.get_having_filters(extras["having_druid"])
            if having_filters:
                qry["having"] = having_filters
        else:
            having_filters = None

        order_direction = "descending" if order_desc else "ascending"

        if (IS_SIP_38 and not metrics and columns and "__time" not in columns) or (
            not IS_SIP_38 and columns
        ):
            columns.append("__time")
            del qry["post_aggregations"]
            del qry["aggregations"]
            del qry["dimensions"]
            qry["columns"] = columns
            qry["metrics"] = []
            qry["granularity"] = "all"
            qry["limit"] = row_limit
            client.scan(**qry)
        elif (IS_SIP_38 and columns) or (
            not IS_SIP_38 and not groupby and not having_filters
        ):
            logger.info("Running timeseries query for no groupby values")
            del qry["dimensions"]
            client.timeseries(**qry)
        elif (
            not having_filters
            and order_desc
            and (
                (IS_SIP_38 and columns and len(columns) == 1)
                or (not IS_SIP_38 and groupby and len(groupby) == 1)
            )
        ):
            dim = list(qry["dimensions"])[0]
            logger.info("Running two-phase topn query for dimension [{}]".format(dim))
            pre_qry = deepcopy(qry)
            order_by: Optional[str] = None
            if timeseries_limit_metric:
                order_by = utils.get_metric_name(timeseries_limit_metric)
                aggs_dict, post_aggs_dict = DruidDatasource.metrics_and_post_aggs(
                    [timeseries_limit_metric], metrics_dict
                )
                if phase == 1:
                    pre_qry["aggregations"].update(aggs_dict)
                    pre_qry["post_aggregations"].update(post_aggs_dict)
                else:
                    pre_qry["aggregations"] = aggs_dict
                    pre_qry["post_aggregations"] = post_aggs_dict
            else:
                agg_keys = qry["aggregations"].keys()
                order_by = list(agg_keys)[0] if agg_keys else None

            # Limit on the number of timeseries, doing a two-phases query
            pre_qry["granularity"] = "all"
            pre_qry["threshold"] = min(row_limit, timeseries_limit or row_limit)
            pre_qry["metric"] = order_by
            pre_qry["dimension"] = self._dimensions_to_values(qry["dimensions"])[0]
            del pre_qry["dimensions"]

            client.topn(**pre_qry)
            logger.info("Phase 1 Complete")
            if phase == 2:
                query_str += "// Two phase query\n// Phase 1\n"
            query_str += json.dumps(
                client.query_builder.last_query.query_dict, indent=2
            )
            query_str += "\n"
            if phase == 1:
                return query_str
            query_str += "// Phase 2 (built based on phase one's results)\n"
            df = client.export_pandas()
            if df is None:
                df = pd.DataFrame()
            qry["filter"] = self._add_filter_from_pre_query_data(
                df, [pre_qry["dimension"]], filters
            )
            qry["threshold"] = timeseries_limit or 1000
            if row_limit and granularity == "all":
                qry["threshold"] = row_limit
            qry["dimension"] = dim
            del qry["dimensions"]
            qry["metric"] = list(qry["aggregations"].keys())[0]
            client.topn(**qry)
            logger.info("Phase 2 Complete")
        elif having_filters or ((IS_SIP_38 and columns) or (not IS_SIP_38 and groupby)):
            # If grouping on multiple fields or using a having filter
            # we have to force a groupby query
            logger.info("Running groupby query for dimensions [{}]".format(dimensions))
            if timeseries_limit and is_timeseries:
                logger.info("Running two-phase query for timeseries")

                pre_qry = deepcopy(qry)
                pre_qry_dims = self._dimensions_to_values(qry["dimensions"])

                # Can't use set on an array with dicts
                # Use set with non-dict items only
                non_dict_dims = list(
                    set([x for x in pre_qry_dims if not isinstance(x, dict)])
                )
                dict_dims = [x for x in pre_qry_dims if isinstance(x, dict)]
                pre_qry["dimensions"] = non_dict_dims + dict_dims  # type: ignore

                order_by = None
                if metrics:
                    order_by = utils.get_metric_name(metrics[0])
                else:
                    order_by = pre_qry_dims[0]  # type: ignore

                if timeseries_limit_metric:
                    order_by = utils.get_metric_name(timeseries_limit_metric)
                    aggs_dict, post_aggs_dict = DruidDatasource.metrics_and_post_aggs(
                        [timeseries_limit_metric], metrics_dict
                    )
                    if phase == 1:
                        pre_qry["aggregations"].update(aggs_dict)
                        pre_qry["post_aggregations"].update(post_aggs_dict)
                    else:
                        pre_qry["aggregations"] = aggs_dict
                        pre_qry["post_aggregations"] = post_aggs_dict

                # Limit on the number of timeseries, doing a two-phases query
                pre_qry["granularity"] = "all"
                pre_qry["limit_spec"] = {
                    "type": "default",
                    "limit": min(timeseries_limit, row_limit),
                    "intervals": self.intervals_from_dttms(
                        inner_from_dttm, inner_to_dttm
                    ),
                    "columns": [{"dimension": order_by, "direction": order_direction}],
                }
                client.groupby(**pre_qry)
                logger.info("Phase 1 Complete")
                query_str += "// Two phase query\n// Phase 1\n"
                query_str += json.dumps(
                    client.query_builder.last_query.query_dict, indent=2
                )
                query_str += "\n"
                if phase == 1:
                    return query_str
                query_str += "// Phase 2 (built based on phase one's results)\n"
                df = client.export_pandas()
                if df is None:
                    df = pd.DataFrame()
                qry["filter"] = self._add_filter_from_pre_query_data(
                    df, pre_qry["dimensions"], qry["filter"]
                )
                qry["limit_spec"] = None
            if row_limit:
                dimension_values = self._dimensions_to_values(dimensions)
                qry["limit_spec"] = {
                    "type": "default",
                    "limit": row_limit,
                    "columns": [
                        {
                            "dimension": (
                                utils.get_metric_name(metrics[0])
                                if metrics
                                else dimension_values[0]
                            ),
                            "direction": order_direction,
                        }
                    ],
                }
            client.groupby(**qry)
            logger.info("Query Complete")
        query_str += json.dumps(client.query_builder.last_query.query_dict, indent=2)
        return query_str

    @staticmethod
    def homogenize_types(df: pd.DataFrame, columns: Iterable[str]) -> pd.DataFrame:
        """Converting all columns to strings

        When grouping by a numeric (say FLOAT) column, pydruid returns
        strings in the dataframe. This creates issues downstream related
        to having mixed types in the dataframe

        Here we replace None with <NULL> and make the whole series a
        str instead of an object.
        """
        df[columns] = df[columns].fillna(NULL_STRING).astype("unicode")
        return df

    def query(self, query_obj: QueryObjectDict) -> QueryResult:
        qry_start_dttm = datetime.now()
        client = self.cluster.get_pydruid_client()
        query_str = self.get_query_str(client=client, query_obj=query_obj, phase=2)
        df = client.export_pandas()
        if df is None:
            df = pd.DataFrame()

        if df.empty:
            return QueryResult(
                df=df, query=query_str, duration=datetime.now() - qry_start_dttm
            )

        df = self.homogenize_types(
            df, query_obj.get("columns" if IS_SIP_38 else "groupby", [])
        )
        df.columns = [
            DTTM_ALIAS if c in ("timestamp", "__time") else c for c in df.columns
        ]

        is_timeseries = (
            query_obj["is_timeseries"] if "is_timeseries" in query_obj else True
        )
        if not is_timeseries and DTTM_ALIAS in df.columns:
            del df[DTTM_ALIAS]

        # Reordering columns
        cols: List[str] = []
        if DTTM_ALIAS in df.columns:
            cols += [DTTM_ALIAS]

        if not IS_SIP_38:
            cols += query_obj.get("groupby") or []
        cols += query_obj.get("columns") or []
        cols += query_obj.get("metrics") or []

        cols = utils.get_metric_names(cols)
        cols = [col for col in cols if col in df.columns]
        df = df[cols]

        time_offset = DruidDatasource.time_offset(query_obj["granularity"])

        def increment_timestamp(ts: str) -> datetime:
            dt = utils.parse_human_datetime(ts).replace(tzinfo=DRUID_TZ)
            return dt + timedelta(milliseconds=time_offset)

        if DTTM_ALIAS in df.columns and time_offset:
            df[DTTM_ALIAS] = df[DTTM_ALIAS].apply(increment_timestamp)

        return QueryResult(
            df=df, query=query_str, duration=datetime.now() - qry_start_dttm
        )

    @staticmethod
    def _create_extraction_fn(
        dim_spec: Dict[str, Any]
    ) -> Tuple[
        str,
        Union[
            "MapLookupExtraction",
            "RegexExtraction",
            "RegisteredLookupExtraction",
            "TimeFormatExtraction",
        ],
    ]:
        extraction_fn = None
        if dim_spec and "extractionFn" in dim_spec:
            col = dim_spec["dimension"]
            fn = dim_spec["extractionFn"]
            ext_type = fn.get("type")
            if ext_type == "lookup" and fn["lookup"].get("type") == "map":
                replace_missing_values = fn.get("replaceMissingValueWith")
                retain_missing_values = fn.get("retainMissingValue", False)
                injective = fn.get("isOneToOne", False)
                extraction_fn = MapLookupExtraction(
                    fn["lookup"]["map"],
                    replace_missing_values=replace_missing_values,
                    retain_missing_values=retain_missing_values,
                    injective=injective,
                )
            elif ext_type == "regex":
                extraction_fn = RegexExtraction(fn["expr"])
            elif ext_type == "registeredLookup":
                extraction_fn = RegisteredLookupExtraction(fn.get("lookup"))
            elif ext_type == "timeFormat":
                extraction_fn = TimeFormatExtraction(
                    fn.get("format"), fn.get("locale"), fn.get("timeZone")
                )
            else:
                raise Exception(_("Unsupported extraction function: " + ext_type))
        return (col, extraction_fn)

    @classmethod
    def get_filters(
        cls,
        raw_filters: List[Dict[str, Any]],
        num_cols: List[str],
        columns_dict: Dict[str, DruidColumn],
    ) -> "Filter":
        """Given Superset filter data structure, returns pydruid Filter(s)"""
        filters = None
        for flt in raw_filters:
            col: Optional[str] = flt.get("col")
            op: Optional[str] = flt["op"].upper() if "op" in flt else None
            eq: Optional[FilterValues] = flt.get("val")
            if (
                not col
                or not op
                or (
                    eq is None
                    and op
                    not in (
                        FilterOperator.IS_NULL.value,
                        FilterOperator.IS_NOT_NULL.value,
                    )
                )
            ):
                continue

            # Check if this dimension uses an extraction function
            # If so, create the appropriate pydruid extraction object
            column_def = columns_dict.get(col)
            dim_spec = column_def.dimension_spec if column_def else None
            extraction_fn = None
            if dim_spec and "extractionFn" in dim_spec:
                (col, extraction_fn) = DruidDatasource._create_extraction_fn(dim_spec)

            cond = None
            is_numeric_col = col in num_cols
            is_list_target = op in (
                FilterOperator.IN.value,
                FilterOperator.NOT_IN.value,
            )
            eq = cls.filter_values_handler(
                eq,
                is_list_target=is_list_target,
                target_column_is_numeric=is_numeric_col,
            )

            # For these two ops, could have used Dimension,
            # but it doesn't support extraction functions
            if op == FilterOperator.EQUALS.value:
                cond = Filter(
                    dimension=col, value=eq, extraction_function=extraction_fn
                )
            elif op == FilterOperator.NOT_EQUALS.value:
                cond = ~Filter(
                    dimension=col, value=eq, extraction_function=extraction_fn
                )
            elif is_list_target:
                eq = cast(List[Any], eq)
                fields = []
                # ignore the filter if it has no value
                if not len(eq):
                    continue
                # if it uses an extraction fn, use the "in" operator
                # as Dimension isn't supported
                elif extraction_fn is not None:
                    cond = Filter(
                        dimension=col,
                        values=eq,
                        type="in",
                        extraction_function=extraction_fn,
                    )
                elif len(eq) == 1:
                    cond = Dimension(col) == eq[0]
                else:
                    for s in eq:
                        fields.append(Dimension(col) == s)
                    cond = Filter(type="or", fields=fields)
                if op == FilterOperator.NOT_IN.value:
                    cond = ~cond
            elif op == FilterOperator.REGEX.value:
                cond = Filter(
                    extraction_function=extraction_fn,
                    type="regex",
                    pattern=eq,
                    dimension=col,
                )

            # For the ops below, could have used pydruid's Bound,
            # but it doesn't support extraction functions
            elif op == FilterOperator.GREATER_THAN_OR_EQUALS.value:
                cond = Bound(
                    extraction_function=extraction_fn,
                    dimension=col,
                    lowerStrict=False,
                    upperStrict=False,
                    lower=eq,
                    upper=None,
                    ordering=cls._get_ordering(is_numeric_col),
                )
            elif op == FilterOperator.LESS_THAN_OR_EQUALS.value:
                cond = Bound(
                    extraction_function=extraction_fn,
                    dimension=col,
                    lowerStrict=False,
                    upperStrict=False,
                    lower=None,
                    upper=eq,
                    ordering=cls._get_ordering(is_numeric_col),
                )
            elif op == FilterOperator.GREATER_THAN.value:
                cond = Bound(
                    extraction_function=extraction_fn,
                    lowerStrict=True,
                    upperStrict=False,
                    dimension=col,
                    lower=eq,
                    upper=None,
                    ordering=cls._get_ordering(is_numeric_col),
                )
            elif op == FilterOperator.LESS_THAN.value:
                cond = Bound(
                    extraction_function=extraction_fn,
                    upperStrict=True,
                    lowerStrict=False,
                    dimension=col,
                    lower=None,
                    upper=eq,
                    ordering=cls._get_ordering(is_numeric_col),
                )
            elif op == FilterOperator.IS_NULL.value:
                cond = Filter(dimension=col, value="")
            elif op == FilterOperator.IS_NOT_NULL.value:
                cond = ~Filter(dimension=col, value="")

            if filters:
                filters = Filter(type="and", fields=[cond, filters])
            else:
                filters = cond

        return filters

    @staticmethod
    def _get_ordering(is_numeric_col: bool) -> str:
        return "numeric" if is_numeric_col else "lexicographic"

    def _get_having_obj(self, col: str, op: str, eq: str) -> "Having":
        cond = None
        if op == FilterOperator.EQUALS.value:
            if col in self.column_names:
                cond = DimSelector(dimension=col, value=eq)
            else:
                cond = Aggregation(col) == eq
        elif op == FilterOperator.GREATER_THAN.value:
            cond = Aggregation(col) > eq
        elif op == FilterOperator.LESS_THAN.value:
            cond = Aggregation(col) < eq

        return cond

    def get_having_filters(
        self, raw_filters: List[Dict[str, Any]]
    ) -> Optional["Having"]:
        filters = None
        reversed_op_map = {
            FilterOperator.NOT_EQUALS.value: FilterOperator.EQUALS.value,
            FilterOperator.GREATER_THAN_OR_EQUALS.value: FilterOperator.LESS_THAN.value,
            FilterOperator.LESS_THAN_OR_EQUALS.value: FilterOperator.GREATER_THAN.value,
        }

        for flt in raw_filters:
            if not all(f in flt for f in ["col", "op", "val"]):
                continue
            col = flt["col"]
            op = flt["op"]
            eq = flt["val"]
            cond = None
            if op in [
                FilterOperator.EQUALS.value,
                FilterOperator.GREATER_THAN.value,
                FilterOperator.LESS_THAN.value,
            ]:
                cond = self._get_having_obj(col, op, eq)
            elif op in reversed_op_map:
                cond = ~self._get_having_obj(col, reversed_op_map[op], eq)

            if filters:
                filters = filters & cond
            else:
                filters = cond
        return filters

    @classmethod
    def query_datasources_by_name(
        cls, database: Database, datasource_name: str, schema: Optional[str] = None,
    ) -> List["DruidDatasource"]:
        return []

    def external_metadata(self) -> List[Dict[str, Any]]:
        self.merge_flag = True
        latest_metadata = self.latest_metadata() or {}
        return [{"name": k, "type": v.get("type")} for k, v in latest_metadata.items()]


sa.event.listen(DruidDatasource, "after_insert", security_manager.set_perm)
sa.event.listen(DruidDatasource, "after_update", security_manager.set_perm)
