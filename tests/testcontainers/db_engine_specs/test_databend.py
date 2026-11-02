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
Tests db_engine_specs.databend against a real Databend instance, spun up
on demand via testcontainers. Run via .github/workflows/testcontainers.yml.

Databend has no dedicated testcontainers module, so this uses a generic
DockerContainer against the official `datafuselabs/databend` standalone
image. Superset's DatabendEngineSpec defaults to `sslmode=require`
(`encryption_parameters`), but the local standalone image has no TLS
listener, so this connects with `sslmode=disable` explicitly.
"""

from collections.abc import Iterator

import pytest
from sqlalchemy import (
    Column,
    create_engine,
    inspect,
    Integer,
    MetaData,
    Table as SATable,
)
from sqlalchemy.engine import Engine

from superset.db_engine_specs.databend import DatabendEngineSpec
from superset.sql.parse import Table
from superset.utils.core import GenericDataType

pytestmark = pytest.mark.testcontainers

from ._driver import require_driver  # noqa: E402

require_driver("testcontainers.core.container")
require_driver("databend_sqlalchemy")

from testcontainers.core.container import DockerContainer  # noqa: E402
from testcontainers.core.wait_strategies import LogMessageWaitStrategy  # noqa: E402

from ._pagination import (  # noqa: E402
    assert_paginated_query_returns_correct_rows_in_order,
)

HTTP_PORT = 8000
DBNAME = "default"

# The image's entrypoint (databendlabs/databend docker/bootstrap.sh) gates
# databend-query on a bare `sleep 1` after backgrounding databend-meta. When
# metasrv's on-disk data upgrade and leader election overrun that one second
# -- intermittently, on a loaded runner -- query's single connection attempt
# to metasrv's gRPC port is refused, query exits, and nothing restarts it.
# The entrypoint's closing `wait` keeps waiting on the surviving metasrv and
# log-tail PIDs, so the container stays "running" while the banner line below
# can never be emitted. Widening the wait timeout therefore cannot help; only
# a fresh container can re-run the race, hence retrying bring-up.
START_ATTEMPTS = 3


@pytest.fixture(scope="module")
def engine() -> Iterator[Engine]:
    for attempt in range(1, START_ATTEMPTS + 1):
        container = DockerContainer("datafuselabs/databend")
        container.with_exposed_ports(HTTP_PORT)
        # The image's own startup banner documents this exact line as proof its
        # HTTP query endpoint is bound and ready.
        container.waiting_for(
            LogMessageWaitStrategy(f"listened at 0.0.0.0:{HTTP_PORT}")
        )
        try:
            container.start()
            break
        except TimeoutError:
            container.stop()
            if attempt == START_ATTEMPTS:
                raise
        except Exception:
            # Anything other than the metasrv race (a docker daemon error,
            # an image pull failure) isn't going to be fixed by retrying;
            # stop the container so it doesn't leak, then propagate.
            container.stop()
            raise

    try:
        host = container.get_container_host_ip()
        port = container.get_exposed_port(HTTP_PORT)
        # "root" with no password is the image's builtin user -- confirmed
        # directly against a running container, not from the image's own
        # doc text, which only shows ${USER}/${PASSWORD} placeholders.
        yield create_engine(f"databend://root:@{host}:{port}/{DBNAME}?sslmode=disable")
    finally:
        container.stop()


def test_paginated_query_returns_correct_rows_in_order(engine: Engine) -> None:
    """
    A plain SQLAlchemy Core LIMIT/OFFSET query, compiled and executed against
    a real instance. Mocked tests cannot catch a dialect compiling this
    incorrectly (see apache/superset#42899, where Trino emitted OFFSET
    before LIMIT) -- only real execution can.
    """
    assert_paginated_query_returns_correct_rows_in_order(engine)


def test_get_columns_maps_native_types(engine: Engine) -> None:
    """
    DatabendEngineSpec.get_columns wraps a real SQLAlchemy Inspector; this
    exercises that against actual server-reported column metadata rather
    than a mocked Inspector.
    """
    metadata = MetaData()
    SATable(
        "pilot_types",
        metadata,
        Column("id", Integer, primary_key=True),
        Column("amount", Integer),
    )
    metadata.create_all(engine)

    inspector = inspect(engine)
    columns = DatabendEngineSpec.get_columns(inspector, Table("pilot_types"))

    by_name = {col["column_name"]: col for col in columns}
    assert set(by_name) == {"id", "amount"}
    for col in by_name.values():
        spec = DatabendEngineSpec.get_column_spec(str(col["type"]))
        assert spec is not None
        assert spec.generic_type == GenericDataType.NUMERIC
        assert isinstance(spec.sqla_type, Integer)
