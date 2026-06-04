from __future__ import annotations

from typing import TYPE_CHECKING, Any

import pyarrow as pa

if TYPE_CHECKING:
    import pandas as pd
    from superset.connectors.sqla.models import SqlaTable


def list_datasets() -> list["SqlaTable"]:
    """
    Return every ``SqlaTable`` the current user can access, sorted by name.

    Read inside the function so the module can be imported in unit tests that
    do not have a Flask app context — these helpers are only called at runtime.
    """
    from superset import db
    from superset.connectors.sqla.models import SqlaTable

    # ``no_autoflush`` prevents SQLAlchemy from flushing pending session state
    # while we iterate over results — flushing during iteration of the
    # session's pending deque has been observed to raise "deque mutated
    # during iteration" in this codebase.
    with db.session.no_autoflush:
        datasets = db.session.query(SqlaTable).all()
    return sorted(datasets, key=lambda d: d.table_name)


def get_dataset_by_id(dataset_id: int) -> "SqlaTable":
    """
    Look up a dataset by primary key, eagerly materialising its columns and
    metrics so downstream code can iterate them without triggering further
    lazy loads (and without risking autoflush mid-iteration).
    """
    from sqlalchemy.orm import selectinload

    from superset import db
    from superset.connectors.sqla.models import SqlaTable

    with db.session.no_autoflush:
        dataset = (
            db.session.query(SqlaTable)
            .options(
                selectinload(SqlaTable.columns),
                selectinload(SqlaTable.metrics),
            )
            .filter_by(id=dataset_id)
            .one_or_none()
        )
        if dataset is None:
            raise ValueError(f"Dataset with id {dataset_id} does not exist.")
        # Force materialisation inside the no_autoflush block so later access
        # never lazy-loads while another flush is in progress.
        list(dataset.columns)
        list(dataset.metrics)
    return dataset


def dataset_label(dataset: "SqlaTable") -> str:
    """
    Human-readable label for a dataset combining schema and table name.
    """
    parts = [
        part
        for part in (dataset.catalog, dataset.schema, dataset.table_name)
        if part
    ]
    return ".".join(parts) if parts else dataset.table_name


def df_to_arrow(df: "pd.DataFrame") -> pa.Table:
    """
    Convert a pandas DataFrame to a pyarrow Table, falling back gracefully when
    the DataFrame is empty.
    """
    if df is None or df.empty:
        return pa.table({col: [] for col in (df.columns if df is not None else [])})
    return pa.Table.from_pandas(df, preserve_index=False)


def coerce_literal(value: Any) -> Any:
    """
    Coerce filter literal values to native Python types sqlglot can serialise.
    """
    if isinstance(value, (set, frozenset)):
        return [coerce_literal(v) for v in value]
    return value
