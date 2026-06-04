# flake8: noqa: E501

import sys
import types
from unittest.mock import MagicMock

import pandas as pd
import pyarrow as pa
import pytest

from preset_io.dataset_semantic_layer.utils import (
    coerce_literal,
    dataset_label,
    df_to_arrow,
)


# ---------------------------------------------------------------------------
# Pure helpers
# ---------------------------------------------------------------------------


def test_coerce_literal_passes_through_scalars() -> None:
    assert coerce_literal("x") == "x"
    assert coerce_literal(42) == 42
    assert coerce_literal(None) is None


def test_coerce_literal_unwraps_sets() -> None:
    result = coerce_literal({"a", "b"})
    assert isinstance(result, list)
    assert set(result) == {"a", "b"}


def test_dataset_label_combines_parts() -> None:
    ds = MagicMock(spec=[])
    ds.catalog = "warehouse"
    ds.schema = "public"
    ds.table_name = "orders"
    assert dataset_label(ds) == "warehouse.public.orders"


def test_dataset_label_skips_blank_parts() -> None:
    ds = MagicMock(spec=[])
    ds.catalog = None
    ds.schema = None
    ds.table_name = "orders"
    assert dataset_label(ds) == "orders"


def test_df_to_arrow_with_data() -> None:
    df = pd.DataFrame({"a": [1, 2], "b": ["x", "y"]})
    table = df_to_arrow(df)
    assert table.num_rows == 2
    assert table.column_names == ["a", "b"]


def test_df_to_arrow_with_empty_df() -> None:
    df = pd.DataFrame(columns=["a", "b"])
    table = df_to_arrow(df)
    assert table.num_rows == 0
    assert table.column_names == ["a", "b"]


def test_df_to_arrow_with_none() -> None:
    table = df_to_arrow(None)
    assert table.num_rows == 0


# ---------------------------------------------------------------------------
# Session-bound helpers — superset is stubbed so we don't require a Flask app
# ---------------------------------------------------------------------------


@pytest.fixture
def fake_superset(monkeypatch: pytest.MonkeyPatch) -> tuple[MagicMock, type]:
    """
    Provide a minimal stand-in for ``superset.db`` and
    ``superset.connectors.sqla.models.SqlaTable`` so list/get helpers run
    without a real Flask app or database.
    """

    class FakeSqlaTable:  # noqa: D401 — marker class only
        """Sentinel used as the queried entity."""

        columns: list = []
        metrics: list = []

    session = MagicMock()
    db_module = types.ModuleType("superset")
    db_module.db = MagicMock()
    db_module.db.session = session

    sqla_models = types.ModuleType("superset.connectors.sqla.models")
    sqla_models.SqlaTable = FakeSqlaTable
    connectors_module = types.ModuleType("superset.connectors")
    connectors_sqla = types.ModuleType("superset.connectors.sqla")

    monkeypatch.setitem(sys.modules, "superset", db_module)
    monkeypatch.setitem(sys.modules, "superset.connectors", connectors_module)
    monkeypatch.setitem(sys.modules, "superset.connectors.sqla", connectors_sqla)
    monkeypatch.setitem(sys.modules, "superset.connectors.sqla.models", sqla_models)

    # Also stub sqlalchemy.orm.selectinload for get_dataset_by_id.
    return session, FakeSqlaTable


def test_list_datasets_returns_sorted(fake_superset) -> None:
    from preset_io.dataset_semantic_layer.utils import list_datasets

    session, _ = fake_superset

    a, b, c = MagicMock(), MagicMock(), MagicMock()
    a.table_name = "z_users"
    b.table_name = "a_orders"
    c.table_name = "m_payments"
    session.no_autoflush.__enter__.return_value = None
    session.no_autoflush.__exit__.return_value = False
    session.query.return_value.all.return_value = [a, b, c]

    result = list_datasets()
    assert [d.table_name for d in result] == ["a_orders", "m_payments", "z_users"]


def test_get_dataset_by_id_raises_when_missing(fake_superset) -> None:
    from preset_io.dataset_semantic_layer.utils import get_dataset_by_id

    session, _ = fake_superset

    session.no_autoflush.__enter__.return_value = None
    session.no_autoflush.__exit__.return_value = False
    (
        session.query.return_value.options.return_value.filter_by.return_value.one_or_none.return_value
    ) = None

    with pytest.raises(ValueError, match="Dataset with id 42 does not exist."):
        get_dataset_by_id(42)


def test_get_dataset_by_id_materialises_relationships(fake_superset) -> None:
    from preset_io.dataset_semantic_layer.utils import get_dataset_by_id

    session, _ = fake_superset

    dataset = MagicMock()
    # Use real lists so iteration in get_dataset_by_id doesn't error.
    dataset.columns = ["col1", "col2"]
    dataset.metrics = ["m1"]

    session.no_autoflush.__enter__.return_value = None
    session.no_autoflush.__exit__.return_value = False
    (
        session.query.return_value.options.return_value.filter_by.return_value.one_or_none.return_value
    ) = dataset

    result = get_dataset_by_id(1)
    assert result is dataset
