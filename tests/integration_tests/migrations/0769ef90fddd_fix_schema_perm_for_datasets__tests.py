from importlib import import_module

import pytest
from superset import db
from superset.connectors.sqla.models import SqlaTable
from superset.models.slice import Slice
from tests.integration_tests.fixtures.birth_names_dashboard import (
    load_birth_names_dashboard_with_slices,
    load_birth_names_data,
)

migration_module = import_module(
    "superset.migrations.versions."
    "2023-08-02_15-23_0769ef90fddd_fix_schema_perm_for_datasets"
)

fix_datasets_schema_perm = migration_module.fix_datasets_schema_perm
fix_charts_schema_perm = migration_module.fix_charts_schema_perm


@pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
def test_fix_schema_perm():
    dataset = db.session.query(SqlaTable).filter_by(table_name="birth_names").one()
    chart = db.session.query(Slice).filter_by(slice_name="Girls").one()
    dataset.schema_perm = "wrong"
    chart.schema_perm = "wrong"
    db.session.commit()

    fix_datasets_schema_perm(db.session)
    db.session.commit()
    assert dataset.schema_perm == "[examples].[public]"

    fix_charts_schema_perm(db.session)
    db.session.commit()
    assert chart.schema_perm == "[examples].[public]"
