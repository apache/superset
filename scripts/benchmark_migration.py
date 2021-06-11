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
import importlib.util
import logging
import re
import time
from collections import defaultdict
from inspect import getsource
from pathlib import Path
from types import ModuleType
from typing import Dict, List, Set, Type

import click
from flask import current_app
from flask_appbuilder import Model
from flask_migrate import downgrade, upgrade
from graphlib import TopologicalSorter  # pylint: disable=wrong-import-order
from sqlalchemy import create_engine, inspect, Table
from sqlalchemy.ext.automap import automap_base

from superset import db
from superset.utils.mock_data import add_sample_rows

logger = logging.getLogger(__name__)


def import_migration_script(filepath: Path) -> ModuleType:
    """
    Import migration script as if it were a module.
    """
    spec = importlib.util.spec_from_file_location(filepath.stem, filepath)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)  # type: ignore
    return module


def extract_modified_tables(module: ModuleType) -> Set[str]:
    """
    Extract the tables being modified by a migration script.

    This function uses a simple approach of looking at the source code of
    the migration script looking for patterns. It could be improved by
    actually traversing the AST.
    """

    tables: Set[str] = set()
    for function in {"upgrade", "downgrade"}:
        source = getsource(getattr(module, function))
        tables.update(re.findall(r'alter_table\(\s*"(\w+?)"\s*\)', source, re.DOTALL))
        tables.update(re.findall(r'add_column\(\s*"(\w+?)"\s*,', source, re.DOTALL))
        tables.update(re.findall(r'drop_column\(\s*"(\w+?)"\s*,', source, re.DOTALL))

    return tables


def find_models(module: ModuleType) -> List[Type[Model]]:
    """
    Find all models in a migration script.
    """
    models: List[Type[Model]] = []
    tables = extract_modified_tables(module)

    # add models defined explicitly in the migration script
    queue = list(module.__dict__.values())
    while queue:
        obj = queue.pop()
        if hasattr(obj, "__tablename__"):
            tables.add(obj.__tablename__)
        elif isinstance(obj, list):
            queue.extend(obj)
        elif isinstance(obj, dict):
            queue.extend(obj.values())

    # build models by automapping the existing tables, instead of using current
    # code; this is needed for migrations that modify schemas (eg, add a column),
    # where the current model is out-of-sync with the existing table after a
    # downgrade
    sqlalchemy_uri = current_app.config["SQLALCHEMY_DATABASE_URI"]
    engine = create_engine(sqlalchemy_uri)
    Base = automap_base()
    Base.prepare(engine, reflect=True)
    for table in tables:
        model = getattr(Base.classes, table)
        model.__tablename__ = table
        models.append(model)

    # sort topologically so we can create entities in order and
    # maintain relationships (eg, create a database before creating
    # a slice)
    sorter = TopologicalSorter()
    for model in models:
        inspector = inspect(model)
        dependent_tables: List[str] = []
        for column in inspector.columns.values():
            for foreign_key in column.foreign_keys:
                dependent_tables.append(foreign_key.target_fullname.split(".")[0])
        sorter.add(model.__tablename__, *dependent_tables)
    order = list(sorter.static_order())
    models.sort(key=lambda model: order.index(model.__tablename__))

    return models


@click.command()
@click.argument("filepath")
@click.option("--limit", default=1000, help="Maximum number of entities.")
@click.option("--force", is_flag=True, help="Do not prompt for confirmation.")
@click.option("--no-auto-cleanup", is_flag=True, help="Do not remove created models.")
def main(
    filepath: str, limit: int = 1000, force: bool = False, no_auto_cleanup: bool = False
) -> None:
    auto_cleanup = not no_auto_cleanup
    session = db.session()

    print(f"Importing migration script: {filepath}")
    module = import_migration_script(Path(filepath))

    revision: str = getattr(module, "revision", "")
    down_revision: str = getattr(module, "down_revision", "")
    if not revision or not down_revision:
        raise Exception(
            "Not a valid migration script, couldn't find down_revision/revision"
        )

    print(f"Migration goes from {down_revision} to {revision}")
    current_revision = db.engine.execute(
        "SELECT version_num FROM alembic_version"
    ).scalar()
    print(f"Current version of the DB is {current_revision}")

    if current_revision != down_revision:
        if not force:
            click.confirm(
                "\nRunning benchmark will downgrade the Superset DB to "
                f"{down_revision} and upgrade to {revision} again. There may "
                "be data loss in downgrades. Continue?",
                abort=True,
            )
        downgrade(revision=down_revision)

    print("\nIdentifying models used in the migration:")
    models = find_models(module)
    model_rows: Dict[Type[Model], int] = {}
    for model in models:
        rows = session.query(model).count()
        print(f"- {model.__name__} ({rows} rows in table {model.__tablename__})")
        model_rows[model] = rows
    session.close()

    print("Benchmarking migration")
    results: Dict[str, float] = {}
    start = time.time()
    upgrade(revision=revision)
    duration = time.time() - start
    results["Current"] = duration
    print(f"Migration on current DB took: {duration:.2f} seconds")

    min_entities = 10
    new_models: Dict[Type[Model], List[Model]] = defaultdict(list)
    while min_entities <= limit:
        downgrade(revision=down_revision)
        print(f"Running with at least {min_entities} entities of each model")
        for model in models:
            missing = min_entities - model_rows[model]
            if missing > 0:
                print(f"- Adding {missing} entities to the {model.__name__} model")
                try:
                    added_models = add_sample_rows(session, model, missing)
                except Exception:
                    session.rollback()
                    raise
                model_rows[model] = min_entities
                session.commit()

                if auto_cleanup:
                    new_models[model].extend(added_models)

        start = time.time()
        upgrade(revision=revision)
        duration = time.time() - start
        print(f"Migration for {min_entities}+ entities took: {duration:.2f} seconds")
        results[f"{min_entities}+"] = duration
        min_entities *= 10

    if auto_cleanup:
        print("Cleaning up DB")
        # delete in reverse order of creation to handle relationships
        for model, entities in list(new_models.items())[::-1]:
            session.query(model).filter(
                model.id.in_(entity.id for entity in entities)
            ).delete(synchronize_session=False)
        session.commit()

    if current_revision != revision and not force:
        click.confirm(f"\nRevert DB to {revision}?", abort=True)
        upgrade(revision=revision)
        print("Reverted")

    print("\nResults:\n")
    for label, duration in results.items():
        print(f"{label}: {duration:.2f} s")


if __name__ == "__main__":
    from superset.app import create_app

    app = create_app()
    with app.app_context():
        # pylint: disable=no-value-for-parameter
        main()
