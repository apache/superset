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

from superset.migrations.shared.utils import create_index, drop_index


# ----- Dummy classes for capturing calls ----- #
class DummyLogger:
    def __init__(self):
        self.messages = []

    def info(self, message):
        self.messages.append(message)


class DummyOp:
    def __init__(self):
        self.called = False
        self.call_kwargs = None

    def create_index(self, **kwargs):
        self.called = True
        self.call_kwargs = kwargs

    def drop_index(self, **kwargs):
        self.called = True
        self.call_kwargs = kwargs


# ----- Fake functions to simulate table index checks ----- #
def fake_table_has_index_true(*args, **kwargs):
    return True


def fake_table_has_index_false(*args, **kwargs):
    return False


# ----- Tests for create_index ----- #
def test_create_index_skips_if_index_exists(monkeypatch):
    dummy_logger = DummyLogger()
    dummy_op = DummyOp()

    # Patch globals in the module where create_index is defined.
    monkeypatch.setattr("superset.migrations.shared.utils.logger", dummy_logger)
    monkeypatch.setattr("superset.migrations.shared.utils.op", dummy_op)
    monkeypatch.setattr(
        "superset.migrations.shared.utils.table_has_index", fake_table_has_index_true
    )

    table_name = "test_table"
    index_name = "idx_test"
    columns = ["col1", "col2"]

    create_index(table_name, index_name, columns, unique=True)

    # When the index already exists, op.create_index should not be called.
    assert dummy_op.called is False
    # And a log message mentioning "already has index" should be generated.
    assert any("already has index" in msg for msg in dummy_logger.messages)


def test_create_index_creates_index(monkeypatch):
    dummy_logger = DummyLogger()
    dummy_op = DummyOp()

    monkeypatch.setattr("superset.migrations.shared.utils.logger", dummy_logger)
    monkeypatch.setattr("superset.migrations.shared.utils.op", dummy_op)
    monkeypatch.setattr(
        "superset.migrations.shared.utils.table_has_index", fake_table_has_index_false
    )

    table_name = "test_table"
    index_name = "idx_test"
    columns = ["col1", "col2"]

    create_index(table_name, index_name, columns, unique=False)

    # When the index does not exist, op.create_index should be called.
    assert dummy_op.called is True
    call_kwargs = dummy_op.call_kwargs
    assert call_kwargs.get("table_name") == table_name
    assert call_kwargs.get("index_name") == index_name
    assert call_kwargs.get("unique") is False
    assert call_kwargs.get("columns") == columns
    # And a log message mentioning "Creating index" should be generated.
    assert any("Creating index" in msg for msg in dummy_logger.messages)


def test_create_unique_index_creates_index(monkeypatch):
    dummy_logger = DummyLogger()
    dummy_op = DummyOp()

    monkeypatch.setattr("superset.migrations.shared.utils.logger", dummy_logger)
    monkeypatch.setattr("superset.migrations.shared.utils.op", dummy_op)
    monkeypatch.setattr(
        "superset.migrations.shared.utils.table_has_index", fake_table_has_index_false
    )

    table_name = "test_table"
    index_name = "idx_test"
    columns = ["col1", "col2"]

    create_index(table_name, index_name, columns, unique=True)

    # When the index does not exist, op.create_index should be called.
    assert dummy_op.called is True
    call_kwargs = dummy_op.call_kwargs
    assert call_kwargs.get("table_name") == table_name
    assert call_kwargs.get("index_name") == index_name
    assert call_kwargs.get("unique") is True
    assert call_kwargs.get("columns") == columns
    # And a log message mentioning "Creating index" should be generated.
    print(dummy_logger.messages)
    assert any("Creating index" in msg for msg in dummy_logger.messages)


def test_create_index_with_not_unique(monkeypatch):
    dummy_logger = DummyLogger()
    dummy_op = DummyOp()

    monkeypatch.setattr("superset.migrations.shared.utils.logger", dummy_logger)
    monkeypatch.setattr("superset.migrations.shared.utils.op", dummy_op)
    monkeypatch.setattr(
        "superset.migrations.shared.utils.table_has_index", fake_table_has_index_false
    )

    table_name = "test_table"
    index_name = "idx_test"
    columns = ["col1", "col2"]

    create_index(table_name, index_name, columns, unique=False)

    # When the index does not exist, op.create_index should be called.
    assert dummy_op.called is True
    call_kwargs = dummy_op.call_kwargs
    assert call_kwargs.get("table_name") == table_name
    assert call_kwargs.get("index_name") == index_name
    assert call_kwargs.get("unique") is False
    assert call_kwargs.get("columns") == columns


# ----- Tests for drop_index ----- #
def test_drop_index_skips_if_index_not_exist(monkeypatch):
    dummy_logger = DummyLogger()
    dummy_op = DummyOp()

    monkeypatch.setattr("superset.migrations.shared.utils.logger", dummy_logger)
    monkeypatch.setattr("superset.migrations.shared.utils.op", dummy_op)
    monkeypatch.setattr(
        "superset.migrations.shared.utils.table_has_index", fake_table_has_index_false
    )

    table_name = "test_table"
    index_name = "idx_test"

    drop_index(table_name, index_name)

    # When the index does not exist, op.drop_index should not be called.
    assert dummy_op.called is False
    # And a log message mentioning "doesn't have index" should be generated.
    assert any("doesn't have index" in msg for msg in dummy_logger.messages)


def test_drop_index_drops_index_when_exists(monkeypatch):
    dummy_logger = DummyLogger()
    dummy_op = DummyOp()

    monkeypatch.setattr("superset.migrations.shared.utils.logger", dummy_logger)
    monkeypatch.setattr("superset.migrations.shared.utils.op", dummy_op)
    monkeypatch.setattr(
        "superset.migrations.shared.utils.table_has_index", fake_table_has_index_true
    )

    table_name = "test_table"
    index_name = "idx_test"

    drop_index(table_name, index_name)

    # When the index exists, op.drop_index should be called.
    assert dummy_op.called is True
    call_kwargs = dummy_op.call_kwargs
    assert call_kwargs.get("table_name") == table_name
    assert call_kwargs.get("index_name") == index_name
    # And a log message mentioning "Dropping index" should be generated.
    assert any("Dropping index" in msg for msg in dummy_logger.messages)
