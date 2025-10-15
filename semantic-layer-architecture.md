# Semantic Layer Architecture for Superset

## Overview

This document outlines the architecture for introducing semantic layers to Superset as siblings to databases. Semantic layers will contain "explorables" (semantic views) that can be explored to create charts, similar to how datasets/queries work today.

## Goals

1. Make semantic layers first-class citizens alongside databases
2. Define a common protocol (`Explorable`) for both datasets and semantic views
3. Minimize code changes by bifurcating at the right abstraction level
4. Maintain backward compatibility
5. Enable future extensibility for other data source types

## Recommended Bifurcation Point

### Primary: The `datasource.query()` Interface

**File**: `superset/common/query_context_processor.py:267-279`

This is the critical junction where we should bifurcate:

```python
def get_query_result(self, query_object: QueryObject) -> QueryResult:
    query = ""
    if isinstance(query_context.datasource, Query):
        result = query_context.datasource.exc_query(query_object.to_dict())
    else:
        result = query_context.datasource.query(query_object.to_dict())  # ← KEY LINE

    df = result.df
    # ... normalization and post-processing
    return result
```

### Why This Is The Perfect Bifurcation Point

1. **Clean interface**: The contract is simple: `query(query_obj: dict) -> QueryResult`
2. **Connector-agnostic**: The `QueryObject` describes *what* to fetch (columns, metrics, filters), not *how*
3. **Everything downstream is already polymorphic**: Post-processing, caching, and formatting all work with DataFrames
4. **Everything upstream is declarative**: Schema parsing and validation don't care about the data source type
5. **Minimal code changes**: Most of the codebase already treats datasources polymorphically

## Implementation Strategy

### 1. Define the `Explorable` Protocol

Create a new file: `superset/explorables/base.py`

```python
"""
Base protocol for explorable data sources in Superset.

An "explorable" is any data source that can be explored to create charts,
including SQL datasets, saved queries, and semantic layer views.
"""
from __future__ import annotations

from typing import Any, Protocol, runtime_checkable

from superset.models.helpers import QueryResult


@runtime_checkable
class Explorable(Protocol):
    """
    Protocol for objects that can be explored to create charts.

    This protocol is implemented by:
    - BaseDatasource (SQL datasets and queries)
    - SemanticView (semantic layer views)
    - Future: GraphQL endpoints, REST APIs, etc.
    """

    # =========================================================================
    # Core Query Interface
    # =========================================================================

    def query(self, query_obj: dict[str, Any]) -> QueryResult:
        """
        Execute a query and return results as a DataFrame.

        :param query_obj: Dictionary describing the query (columns, metrics, filters, etc.)
        :return: QueryResult containing DataFrame and metadata
        """
        ...

    def get_query_str(self, query_obj: dict[str, Any]) -> str:
        """
        Get the query string without executing.

        Used for display in the UI and debugging.

        :param query_obj: Dictionary describing the query
        :return: String representation of the query (SQL, GraphQL, etc.)
        """
        ...

    # =========================================================================
    # Metadata Interface
    # =========================================================================

    @property
    def uid(self) -> str:
        """
        Unique identifier for this explorable.

        Used for caching and security checks.
        Format: "{type}_{id}" (e.g., "table_123", "semantic_view_456")
        """
        ...

    @property
    def type(self) -> str:
        """
        Type discriminator for this explorable.

        Examples: 'table', 'query', 'semantic_view', 'cube_view'
        """
        ...

    @property
    def column_names(self) -> list[str]:
        """
        List of available column names.

        Used for validation and autocomplete.
        """
        ...

    @property
    def columns(self) -> list[Any]:
        """
        List of column metadata objects.

        Each object should have at minimum:
        - column_name: str
        - type: str (data type)
        - is_dttm: bool (whether it's a datetime column)
        """
        ...

    def get_column(self, column_name: str) -> Any:
        """
        Get metadata for a specific column.

        :param column_name: Name of the column
        :return: Column metadata object or None if not found
        """
        ...

    @property
    def data(self) -> dict[str, Any]:
        """
        Additional metadata about this explorable.

        May include:
        - verbose_map: Dict mapping column names to verbose names
        - description: Human-readable description
        - etc.
        """
        ...

    # =========================================================================
    # Caching Interface
    # =========================================================================

    @property
    def cache_timeout(self) -> int | None:
        """
        Default cache timeout in seconds.

        Returns None to use system default.
        """
        ...

    def get_extra_cache_keys(self, query_obj: dict[str, Any]) -> list[Any]:
        """
        Additional cache key components specific to this explorable.

        Used to ensure cache invalidation when the explorable's
        underlying data or configuration changes.

        :param query_obj: The query being executed
        :return: List of additional values to include in cache key
        """
        ...

    @property
    def changed_on(self) -> Any:
        """
        Last modification timestamp.

        Used for cache invalidation.
        """
        ...

    # =========================================================================
    # Time/Date Handling
    # =========================================================================

    @property
    def offset(self) -> int:
        """
        Timezone offset for datetime columns.

        Used to normalize datetime values to user's timezone.
        Returns 0 for UTC.
        """
        ...

    # =========================================================================
    # Security Interface
    # =========================================================================

    @property
    def perm(self) -> str:
        """
        Permission string for this explorable.

        Used by security manager to check access.
        Format depends on type (e.g., "[database].[schema].[table]")
        """
        ...

    @property
    def schema_perm(self) -> str | None:
        """
        Schema-level permission string.

        Optional; used for schema-level access control.
        """
        ...
```

### 2. Key Files to Update

#### A. QueryContext Type Annotation

**File**: `superset/common/query_context.py:41`

```python
from __future__ import annotations

from superset.explorables.base import Explorable

class QueryContext:
    """
    The query context contains the query object and additional fields necessary
    to retrieve the data payload for a given viz.
    """

    cache_type: ClassVar[str] = "df"
    enforce_numerical_metrics: ClassVar[bool] = True

    datasource: Explorable  # ← Changed from BaseDatasource
    slice_: Slice | None = None
    queries: list[QueryObject]
    form_data: dict[str, Any] | None
    result_type: ChartDataResultType
    result_format: ChartDataResultFormat
    force: bool
    custom_cache_timeout: int | None

    cache_values: dict[str, Any]

    _processor: QueryContextProcessor

    def __init__(
        self,
        *,
        datasource: Explorable,  # ← Changed from BaseDatasource
        queries: list[QueryObject],
        slice_: Slice | None,
        form_data: dict[str, Any] | None,
        result_type: ChartDataResultType,
        result_format: ChartDataResultFormat,
        force: bool = False,
        custom_cache_timeout: int | None = None,
        cache_values: dict[str, Any],
    ) -> None:
        self.datasource = datasource
        self.slice_ = slice_
        self.result_type = result_type
        self.result_format = result_format
        self.queries = queries
        self.form_data = form_data
        self.force = force
        self.custom_cache_timeout = custom_cache_timeout
        self.cache_values = cache_values
        self._processor = QueryContextProcessor(self)
```

#### B. QueryContextProcessor Type Annotation

**File**: `superset/common/query_context_processor.py:112`

```python
from superset.explorables.base import Explorable

class QueryContextProcessor:
    """
    The query context contains the query object and additional fields necessary
    to retrieve the data payload for a given viz.
    """

    _query_context: QueryContext
    _qc_datasource: Explorable  # ← Changed from BaseDatasource

    def __init__(self, query_context: QueryContext):
        self._query_context = query_context
        self._qc_datasource = query_context.datasource
```

#### C. ChartDataQueryContextSchema

**File**: `superset/charts/schemas.py:1384`

This is where you'll load the appropriate explorable based on datasource type:

```python
from superset.common.query_context_factory import QueryContextFactory
from superset.explorables.loaders import load_explorable

class ChartDataQueryContextSchema(Schema):
    query_context_factory: QueryContextFactory | None = None
    datasource = fields.Nested(ChartDataDatasourceSchema)
    queries = fields.List(fields.Nested(ChartDataQueryObjectSchema))
    custom_cache_timeout = fields.Integer(
        metadata={"description": "Override the default cache timeout"},
        required=False,
        allow_none=True,
    )

    force = fields.Boolean(
        metadata={
            "description": "Should the queries be forced to load from the source. "
            "Default: `false`"
        },
        allow_none=True,
    )

    result_type = fields.Enum(ChartDataResultType, by_value=True)
    result_format = fields.Enum(ChartDataResultFormat, by_value=True)

    form_data = fields.Raw(allow_none=True, required=False)

    @post_load
    def make_query_context(self, data: dict[str, Any], **kwargs: Any) -> QueryContext:
        # Load the appropriate explorable based on datasource type
        datasource_info = data.get("datasource", {})
        explorable = load_explorable(datasource_info)

        data["datasource"] = explorable
        query_context = self.get_query_context_factory().create(**data)
        return query_context

    def get_query_context_factory(self) -> QueryContextFactory:
        if self.query_context_factory is None:
            from superset.common.query_context_factory import QueryContextFactory
            self.query_context_factory = QueryContextFactory()
        return self.query_context_factory
```

#### D. Explorable Loader

Create a new file: `superset/explorables/loaders.py`

```python
"""
Utilities for loading explorables from datasource specifications.
"""
from __future__ import annotations

from typing import Any

from flask_babel import gettext as _

from superset.daos.exceptions import DatasourceNotFound
from superset.explorables.base import Explorable
from superset.utils.core import DatasourceType


def load_explorable(datasource_spec: dict[str, Any]) -> Explorable:
    """
    Load an explorable from a datasource specification.

    :param datasource_spec: Dictionary with 'id' and 'type' keys
    :return: An Explorable instance (BaseDatasource or SemanticView)
    :raises DatasourceNotFound: If the explorable doesn't exist
    """
    datasource_id = datasource_spec.get("id")
    datasource_type = datasource_spec.get("type")

    if not datasource_id or not datasource_type:
        raise DatasourceNotFound(
            _("Datasource specification must include 'id' and 'type'")
        )

    # Handle semantic views
    if datasource_type == "semantic_view":
        return _load_semantic_view(datasource_id)

    # Handle traditional datasets/queries
    if datasource_type in (DatasourceType.TABLE.value, DatasourceType.QUERY.value):
        return _load_dataset(datasource_id, datasource_type)

    raise DatasourceNotFound(
        _("Unknown datasource type: %(type)s", type=datasource_type)
    )


def _load_dataset(datasource_id: int | str, datasource_type: str) -> Explorable:
    """
    Load a traditional SQL dataset or query.

    Uses existing Superset logic.
    """
    from superset.connectors.sqla.models import SqlaTable
    from superset.daos.datasource import DatasourceDAO
    from superset.models.sql_lab import Query

    # Convert string ID to int if needed
    if isinstance(datasource_id, str):
        # Handle UUID format if needed
        try:
            datasource_id = int(datasource_id)
        except ValueError:
            # Might be a UUID, let the DAO handle it
            pass

    datasource = DatasourceDAO.get_datasource(
        datasource_type=datasource_type,
        datasource_id=datasource_id,
    )

    if not datasource:
        raise DatasourceNotFound(
            _(
                "Datasource %(type)s:%(id)s not found",
                type=datasource_type,
                id=datasource_id,
            )
        )

    return datasource


def _load_semantic_view(view_id: int | str) -> Explorable:
    """
    Load a semantic layer view.

    :param view_id: ID of the semantic view
    :return: SemanticView instance
    """
    from superset.semantic_layers.dao import SemanticViewDAO

    # Convert string ID to int if needed
    if isinstance(view_id, str):
        try:
            view_id = int(view_id)
        except ValueError:
            # Might be a UUID
            pass

    view = SemanticViewDAO.find_by_id(view_id)

    if not view:
        raise DatasourceNotFound(
            _("Semantic view %(id)s not found", id=view_id)
        )

    return view
```

### 3. Semantic Layer Implementation

#### A. Database Models

Create a new file: `superset/semantic_layers/models.py`

```python
"""
SQLAlchemy models for semantic layers.

Semantic layers are siblings to databases, providing access to
pre-defined metrics and dimensions from external semantic layer tools
like Cube.js, dbt metrics, Looker, etc.
"""
from __future__ import annotations

import json
import logging
from typing import Any

import pandas as pd
from flask_appbuilder import Model
from sqlalchemy import Column, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from superset.explorables.base import Explorable
from superset.models.helpers import AuditMixinNullable, ImportExportMixin, QueryResult

logger = logging.getLogger(__name__)


class SemanticLayer(Model, AuditMixinNullable, ImportExportMixin):
    """
    Connection to a semantic layer (sibling to Database).

    Examples:
    - Cube.js deployment
    - dbt Cloud with metrics
    - Looker instance
    - AtScale cube
    """

    __tablename__ = "semantic_layers"

    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False, unique=True)
    description = Column(Text)

    # Type of semantic layer
    connection_type = Column(String(50), nullable=False)
    # Options: 'cube', 'dbt', 'looker', 'atscale', etc.

    # JSON configuration for connecting to the semantic layer
    connection_params = Column(Text, nullable=False)
    # Example for Cube.js:
    # {
    #   "url": "https://my-cube.cloud",
    #   "api_secret": "...",
    #   "api_token": "..."
    # }

    # Cache configuration
    cache_timeout = Column(Integer)

    # Relationships
    views = relationship(
        "SemanticView",
        back_populates="semantic_layer",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<SemanticLayer {self.name}>"

    @property
    def connection_config(self) -> dict[str, Any]:
        """Parse connection params as dictionary."""
        try:
            return json.loads(self.connection_params or "{}")
        except json.JSONDecodeError:
            logger.error(f"Invalid JSON in connection_params for {self.name}")
            return {}

    def get_client(self) -> Any:
        """
        Get a client for this semantic layer.

        Returns the appropriate client based on connection_type:
        - 'cube' -> CubeClient
        - 'dbt' -> DbtClient
        - etc.
        """
        from superset.semantic_layers.clients import get_client_for_type

        return get_client_for_type(
            connection_type=self.connection_type,
            config=self.connection_config,
        )


class SemanticView(Model, AuditMixinNullable, ImportExportMixin, Explorable):
    """
    A view (cube, metric group, etc.) in a semantic layer.

    This is the semantic layer equivalent of a Dataset.
    It can be explored to create charts.
    """

    __tablename__ = "semantic_views"

    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)

    # Foreign key to parent semantic layer
    semantic_layer_id = Column(Integer, ForeignKey("semantic_layers.id"), nullable=False)

    # External identifier in the semantic layer system
    # (e.g., cube name in Cube.js, model name in dbt)
    external_id = Column(String(500), nullable=False)

    # Cached metadata from semantic layer
    # Updated periodically via background job
    metadata_cache = Column(Text)
    # Example structure:
    # {
    #   "dimensions": [
    #     {"name": "user_id", "type": "number", "title": "User ID"},
    #     {"name": "created_at", "type": "time", "title": "Created At"}
    #   ],
    #   "measures": [
    #     {"name": "count", "type": "count", "title": "Count"},
    #     {"name": "total_revenue", "type": "sum", "title": "Total Revenue"}
    #   ]
    # }

    # Cache configuration (overrides semantic layer default)
    cache_timeout = Column(Integer)

    # Relationships
    semantic_layer = relationship("SemanticLayer", back_populates="views")

    def __repr__(self) -> str:
        return f"<SemanticView {self.name}>"

    # =========================================================================
    # Explorable Protocol Implementation
    # =========================================================================

    def query(self, query_obj: dict[str, Any]) -> QueryResult:
        """
        Execute a query against the semantic layer and return results.

        This method:
        1. Translates the Superset QueryObject to semantic layer query format
        2. Executes the query via the semantic layer client
        3. Converts the response to a pandas DataFrame
        4. Returns a QueryResult
        """
        from superset.semantic_layers.translator import translate_query

        # Get the semantic layer client
        client = self.semantic_layer.get_client()

        # Translate Superset query to semantic layer query
        semantic_query = translate_query(
            query_obj=query_obj,
            view=self,
            connection_type=self.semantic_layer.connection_type,
        )

        # Execute the query
        try:
            response = client.execute_query(
                view_id=self.external_id,
                query=semantic_query,
            )

            # Convert to DataFrame
            df = self._response_to_dataframe(response)

            # Get query string for display
            query_str = client.get_query_string(
                view_id=self.external_id,
                query=semantic_query,
            )

            result = QueryResult(
                df=df,
                query=query_str,
                from_dttm=query_obj.get("from_dttm"),
                to_dttm=query_obj.get("to_dttm"),
            )

            return result

        except Exception as ex:
            logger.exception(f"Error querying semantic view {self.name}")

            # Return error result
            result = QueryResult(
                df=pd.DataFrame(),
                query="",
                error=str(ex),
            )
            return result

    def get_query_str(self, query_obj: dict[str, Any]) -> str:
        """Get the query string without executing."""
        from superset.semantic_layers.translator import translate_query

        client = self.semantic_layer.get_client()

        semantic_query = translate_query(
            query_obj=query_obj,
            view=self,
            connection_type=self.semantic_layer.connection_type,
        )

        return client.get_query_string(
            view_id=self.external_id,
            query=semantic_query,
        )

    @property
    def uid(self) -> str:
        """Unique identifier for caching."""
        return f"semantic_view_{self.id}"

    @property
    def type(self) -> str:
        """Type discriminator."""
        return "semantic_view"

    @property
    def column_names(self) -> list[str]:
        """List of available dimensions and measures."""
        metadata = self._get_metadata()

        dimensions = [d["name"] for d in metadata.get("dimensions", [])]
        measures = [m["name"] for m in metadata.get("measures", [])]

        return dimensions + measures

    @property
    def columns(self) -> list[dict[str, Any]]:
        """Column metadata objects."""
        metadata = self._get_metadata()

        columns = []

        # Add dimensions
        for dim in metadata.get("dimensions", []):
            columns.append({
                "column_name": dim["name"],
                "verbose_name": dim.get("title", dim["name"]),
                "type": dim.get("type", "STRING"),
                "is_dttm": dim.get("type") == "time",
            })

        # Add measures
        for measure in metadata.get("measures", []):
            columns.append({
                "column_name": measure["name"],
                "verbose_name": measure.get("title", measure["name"]),
                "type": measure.get("type", "NUMBER"),
                "is_dttm": False,
            })

        return columns

    def get_column(self, column_name: str) -> dict[str, Any] | None:
        """Get metadata for a specific column."""
        for col in self.columns:
            if col["column_name"] == column_name:
                return col
        return None

    @property
    def data(self) -> dict[str, Any]:
        """Additional metadata."""
        metadata = self._get_metadata()

        # Create verbose map
        verbose_map = {}
        for col in self.columns:
            verbose_map[col["column_name"]] = col["verbose_name"]

        return {
            "verbose_map": verbose_map,
            "description": self.description,
            "metadata": metadata,
        }

    @property
    def cache_timeout(self) -> int | None:
        """Cache timeout in seconds."""
        return self.cache_timeout or self.semantic_layer.cache_timeout

    def get_extra_cache_keys(self, query_obj: dict[str, Any]) -> list[Any]:
        """Additional cache key components."""
        # Include the metadata version in cache key
        # so cache invalidates when semantic layer schema changes
        metadata = self._get_metadata()
        metadata_version = metadata.get("version", "v1")

        return [metadata_version]

    @property
    def offset(self) -> int:
        """Timezone offset (default to UTC)."""
        return 0

    @property
    def perm(self) -> str:
        """Permission string."""
        return f"[{self.semantic_layer.name}].[{self.name}]"

    @property
    def schema_perm(self) -> str | None:
        """Schema-level permission."""
        return f"[{self.semantic_layer.name}]"

    # =========================================================================
    # Helper Methods
    # =========================================================================

    def _get_metadata(self) -> dict[str, Any]:
        """Get cached metadata, parsing from JSON."""
        try:
            return json.loads(self.metadata_cache or "{}")
        except json.JSONDecodeError:
            logger.error(f"Invalid metadata cache for {self.name}")
            return {}

    def _response_to_dataframe(self, response: Any) -> pd.DataFrame:
        """
        Convert semantic layer response to pandas DataFrame.

        Format depends on the semantic layer type.
        """
        # This will be implemented based on the specific
        # semantic layer's response format

        if isinstance(response, pd.DataFrame):
            return response

        if isinstance(response, dict) and "data" in response:
            return pd.DataFrame(response["data"])

        if isinstance(response, list):
            return pd.DataFrame(response)

        logger.warning(f"Unexpected response format: {type(response)}")
        return pd.DataFrame()

    def refresh_metadata(self) -> None:
        """
        Refresh cached metadata from the semantic layer.

        Should be called periodically via background job.
        """
        client = self.semantic_layer.get_client()

        try:
            metadata = client.get_view_metadata(self.external_id)
            self.metadata_cache = json.dumps(metadata)

        except Exception as ex:
            logger.exception(f"Error refreshing metadata for {self.name}")
            raise
```

#### B. Data Access Object (DAO)

Create a new file: `superset/semantic_layers/dao.py`

```python
"""
Data Access Object for semantic layers.
"""
from __future__ import annotations

from typing import Any

from superset.daos.base import BaseDAO
from superset.semantic_layers.models import SemanticLayer, SemanticView


class SemanticLayerDAO(BaseDAO):
    model_cls = SemanticLayer


class SemanticViewDAO(BaseDAO):
    model_cls = SemanticView

    @classmethod
    def find_by_semantic_layer(
        cls, semantic_layer_id: int
    ) -> list[SemanticView]:
        """Find all views for a given semantic layer."""
        return (
            cls.get_session()
            .query(SemanticView)
            .filter(SemanticView.semantic_layer_id == semantic_layer_id)
            .all()
        )
```

#### C. Query Translator

Create a new file: `superset/semantic_layers/translator.py`

```python
"""
Translate Superset QueryObject to semantic layer query format.
"""
from __future__ import annotations

from typing import Any, TYPE_CHECKING

if TYPE_CHECKING:
    from superset.semantic_layers.models import SemanticView


def translate_query(
    query_obj: dict[str, Any],
    view: SemanticView,
    connection_type: str,
) -> dict[str, Any]:
    """
    Translate Superset QueryObject to semantic layer query.

    :param query_obj: Superset query object dictionary
    :param view: The semantic view being queried
    :param connection_type: Type of semantic layer ('cube', 'dbt', etc.)
    :return: Semantic layer query dictionary
    """

    # Route to appropriate translator based on connection type
    if connection_type == "cube":
        return _translate_to_cube(query_obj, view)
    elif connection_type == "dbt":
        return _translate_to_dbt(query_obj, view)
    else:
        raise ValueError(f"Unsupported connection type: {connection_type}")


def _translate_to_cube(
    query_obj: dict[str, Any],
    view: SemanticView,
) -> dict[str, Any]:
    """
    Translate to Cube.js query format.

    Cube.js query format:
    {
      "dimensions": ["User.city", "User.state"],
      "measures": ["User.count"],
      "timeDimensions": [{
        "dimension": "Order.createdAt",
        "dateRange": ["2020-01-01", "2020-12-31"]
      }],
      "filters": [{
        "member": "User.country",
        "operator": "equals",
        "values": ["US"]
      }],
      "limit": 1000
    }
    """

    cube_query: dict[str, Any] = {}

    # Map columns to dimensions
    columns = query_obj.get("columns", [])
    if columns:
        cube_query["dimensions"] = [
            f"{view.external_id}.{col}" for col in columns
        ]

    # Map metrics to measures
    metrics = query_obj.get("metrics", [])
    if metrics:
        cube_query["measures"] = [
            f"{view.external_id}.{metric}" for metric in metrics
        ]

    # Map filters
    filters = query_obj.get("filter", [])
    if filters:
        cube_query["filters"] = [
            _translate_filter_to_cube(f, view) for f in filters
        ]

    # Map time range
    from_dttm = query_obj.get("from_dttm")
    to_dttm = query_obj.get("to_dttm")
    granularity = query_obj.get("granularity")

    if from_dttm and to_dttm and granularity:
        cube_query["timeDimensions"] = [{
            "dimension": f"{view.external_id}.{granularity}",
            "dateRange": [
                from_dttm.isoformat(),
                to_dttm.isoformat(),
            ]
        }]

    # Map limit
    row_limit = query_obj.get("row_limit")
    if row_limit:
        cube_query["limit"] = row_limit

    return cube_query


def _translate_filter_to_cube(
    filter_obj: dict[str, Any],
    view: SemanticView,
) -> dict[str, Any]:
    """Translate a single filter to Cube.js format."""

    # Map Superset operators to Cube.js operators
    operator_map = {
        "==": "equals",
        "!=": "notEquals",
        ">": "gt",
        "<": "lt",
        ">=": "gte",
        "<=": "lte",
        "IN": "equals",  # Cube uses 'equals' with array values
        "NOT IN": "notEquals",
        "LIKE": "contains",
    }

    col = filter_obj.get("col")
    op = filter_obj.get("op")
    val = filter_obj.get("val")

    cube_op = operator_map.get(op, "equals")

    return {
        "member": f"{view.external_id}.{col}",
        "operator": cube_op,
        "values": [val] if not isinstance(val, list) else val,
    }


def _translate_to_dbt(
    query_obj: dict[str, Any],
    view: SemanticView,
) -> dict[str, Any]:
    """
    Translate to dbt metrics query format.

    (Implementation depends on dbt Semantic Layer API)
    """
    # TODO: Implement based on dbt Semantic Layer spec
    raise NotImplementedError("dbt translation not yet implemented")
```

### 4. Security Integration

Update `superset/security/manager.py` to handle semantic view permissions:

```python
def raise_for_access(
    self,
    *,
    database: Database | None = None,
    datasource: BaseDatasource | None = None,
    query: Query | None = None,
    query_context: QueryContext | None = None,
    table: Table | None = None,
    viz: BaseViz | None = None,
) -> None:
    """
    Raise an exception if the user cannot access the resource.

    Updated to handle semantic views.
    """

    # Handle QueryContext (may contain semantic view)
    if query_context:
        datasource = query_context.datasource

        # Check if this is a semantic view
        if datasource.type == "semantic_view":
            self._raise_for_semantic_view_access(datasource)
            return

    # ... existing logic for other cases


def _raise_for_semantic_view_access(self, semantic_view: Any) -> None:
    """Check access for semantic views."""

    # Check if user has permission to access this semantic view
    if not self.can_access("datasource_access", semantic_view.perm):
        raise SupersetSecurityException(
            SupersetError(
                error_type=SupersetErrorType.DATASOURCE_SECURITY_ACCESS_ERROR,
                message=_("You don't have access to this semantic view"),
                level=ErrorLevel.ERROR,
            )
        )
```

### 5. API Endpoints

Create REST API endpoints for CRUD operations on semantic layers:

**File**: `superset/semantic_layers/api.py`

```python
"""
REST API for semantic layers.
"""
from flask_appbuilder.api import expose, protect, safe

from superset.semantic_layers.dao import SemanticLayerDAO, SemanticViewDAO
from superset.semantic_layers.schemas import (
    SemanticLayerPostSchema,
    SemanticLayerPutSchema,
    SemanticViewPostSchema,
)
from superset.views.base_api import BaseSupersetModelRestApi


class SemanticLayerRestApi(BaseSupersetModelRestApi):
    datamodel = SemanticLayerDAO

    resource_name = "semantic_layer"
    allow_browser_login = True

    class_permission_name = "SemanticLayer"

    # Schemas
    add_model_schema = SemanticLayerPostSchema()
    edit_model_schema = SemanticLayerPutSchema()

    # ... standard CRUD endpoints


class SemanticViewRestApi(BaseSupersetModelRestApi):
    datamodel = SemanticViewDAO

    resource_name = "semantic_view"
    allow_browser_login = True

    class_permission_name = "SemanticView"

    # Schemas
    add_model_schema = SemanticViewPostSchema()

    # ... standard CRUD endpoints

    @expose("/<int:pk>/refresh_metadata", methods=["POST"])
    @protect()
    @safe
    def refresh_metadata(self, pk: int):
        """Refresh metadata cache for a semantic view."""
        view = self.datamodel.get(pk, self._base_filters)
        if not view:
            return self.response_404()

        try:
            view.refresh_metadata()
            return self.response(200, message="Metadata refreshed")
        except Exception as ex:
            return self.response_500(message=str(ex))
```

## Files That Don't Need Changes

Because the bifurcation happens at the right level, most code doesn't need changes:

✅ **ChartDataCommand** - Works with QueryContext
✅ **Post-processing logic** - Works with DataFrames
✅ **Caching logic** - Uses `Explorable.uid` and `get_extra_cache_keys()`
✅ **Response formatting** - Works with DataFrames
✅ **QueryObject** - Already connector-agnostic
✅ **QueryContextProcessor.get_df_payload()** - Works with any explorable
✅ **All visualization plugins** - Work with data payloads

## Files That Need Updates

🔧 **Type annotations**: Change `BaseDatasource` → `Explorable` throughout
🔧 **Schema deserialization**: `ChartDataQueryContextSchema` needs to route to correct loader
🔧 **Security**: Add permission checks for semantic views in `SecurityManager`
🔧 **API endpoints**: New REST APIs for semantic layer CRUD
🔧 **Frontend**: New UI for creating/managing semantic layer connections

## Migration Path

### Phase 1: Create Protocol (No Breaking Changes)

1. Create `superset/explorables/base.py` with `Explorable` protocol
2. Create `superset/explorables/loaders.py` with loader functions
3. Verify `BaseDatasource` implicitly satisfies the protocol
4. Add type stubs but don't enforce yet (use `# type: ignore` where needed)

**Deliverable**: Protocol defined, no runtime changes

### Phase 2: Implement Semantic Views

1. Create database migrations for `semantic_layers` and `semantic_views` tables
2. Create `superset/semantic_layers/models.py` with `SemanticLayer` and `SemanticView`
3. Implement `Explorable` protocol for `SemanticView`
4. Create DAOs in `superset/semantic_layers/dao.py`
5. Create query translator in `superset/semantic_layers/translator.py`
6. Add schema deserialization logic in `ChartDataQueryContextSchema`
7. Add security/permissions for semantic views
8. Create REST API endpoints

**Deliverable**: Semantic views work end-to-end, existing datasets unchanged

### Phase 3: Gradual Type Migration

1. Change `QueryContext.datasource` type from `BaseDatasource` to `Explorable`
2. Change `QueryContextProcessor._qc_datasource` type to `Explorable`
3. Update type hints in related files
4. Run `pre-commit run mypy` to catch type issues
5. Fix any type errors

**Deliverable**: Full type safety, both paths use `Explorable`

### Phase 4: Formalize Dataset Explorable (Optional)

1. Make `BaseDatasource` explicitly implement `Explorable` (add to class signature)
2. Verify all protocol methods are implemented
3. Add runtime checks if needed
4. Update documentation

**Deliverable**: Clean, explicit protocol implementation for all explorables

## Key Advantages of This Approach

1. **Minimal disruption**: The query execution path already works polymorphically
2. **Type safety**: Protocol ensures both implementations have the same interface
3. **Clean separation**: Semantic layer lives in its own module but integrates seamlessly
4. **Reuses everything**: Caching, post-processing, security, API responses all work unchanged
5. **Future-proof**: Easy to add more explorable types (GraphQL, REST APIs, etc.)
6. **No breaking changes**: Existing datasets continue to work exactly as before
7. **Testable**: Each component can be unit tested independently

## Example: Adding a New Semantic Layer Type

To add support for a new semantic layer (e.g., Looker):

1. Add `'looker'` to supported connection types
2. Implement `LookerClient` in `superset/semantic_layers/clients/`
3. Add `_translate_to_looker()` in `translator.py`
4. That's it! Everything else reuses existing infrastructure

## Testing Strategy

### Unit Tests

- Test `Explorable` protocol compliance for both `BaseDatasource` and `SemanticView`
- Test query translation for each semantic layer type
- Test metadata caching and refresh
- Test security permissions

### Integration Tests

- Test end-to-end chart creation using semantic views
- Test caching behavior
- Test error handling when semantic layer is unavailable
- Test post-processing operations

### E2E Tests (Playwright)

- Test UI for creating semantic layer connections
- Test chart creation from semantic views
- Test exploration workflow

## Future Enhancements

Once the `Explorable` protocol is established, it opens up many possibilities:

1. **GraphQL endpoints** as explorables
2. **REST APIs** as explorables
3. **Spreadsheet files** (Google Sheets, Excel) as explorables
4. **OLAP cubes** as explorables
5. **Machine learning model outputs** as explorables

All of these would implement the same `Explorable` protocol and integrate seamlessly with the existing infrastructure.
