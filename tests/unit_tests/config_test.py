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
# pylint: disable=import-outside-toplevel, unused-argument, redefined-outer-name, invalid-name

from functools import partial
from typing import Any, TYPE_CHECKING

import pytest
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

from superset import db
from tests.conftest import with_config

if TYPE_CHECKING:
    from superset.connectors.sqla.models import SqlaTable

FULL_DTTM_DEFAULTS_EXAMPLE = {
    "main_dttm_col": "id",
    "dttm_columns": {
        "dttm": {
            "python_date_format": "epoch_s",
            "expression": "CAST(dttm as INTEGER)",
        },
        "id": {"python_date_format": "epoch_ms"},
        "month": {
            "python_date_format": "%Y-%m-%d",
            "expression": (
                "CASE WHEN length(month) = 7 THEN month || '-01' ELSE month END"
            ),
        },
    },
}


def apply_dttm_defaults(table: "SqlaTable", dttm_defaults: dict[str, Any]) -> None:
    """Applies dttm defaults to the table, mutates in place."""
    for dbcol in table.columns:
        # Set is_dttm is column is listed in dttm_columns.
        if dbcol.column_name in dttm_defaults.get("dttm_columns", {}):
            dbcol.is_dttm = True

        # Skip non dttm columns.
        if dbcol.column_name not in dttm_defaults.get("dttm_columns", {}):
            continue

        # Set table main_dttm_col.
        if dbcol.column_name == dttm_defaults.get("main_dttm_col"):
            table.main_dttm_col = dbcol.column_name

        # Apply defaults if empty.
        dttm_column_defaults = dttm_defaults.get("dttm_columns", {}).get(
            dbcol.column_name, {}
        )
        dbcol.is_dttm = True
        if (
            not dbcol.python_date_format
            and "python_date_format" in dttm_column_defaults
        ):
            dbcol.python_date_format = dttm_column_defaults["python_date_format"]
        if not dbcol.expression and "expression" in dttm_column_defaults:
            dbcol.expression = dttm_column_defaults["expression"]


@pytest.fixture
def test_table(session: Session) -> "SqlaTable":
    """
    Fixture that generates an in-memory table.
    """
    from superset.connectors.sqla.models import SqlaTable, TableColumn
    from superset.models.core import Database

    engine = db.session.get_bind()
    SqlaTable.metadata.create_all(engine)  # pylint: disable=no-member

    columns = [
        TableColumn(column_name="ds", is_dttm=1, type="TIMESTAMP"),
        TableColumn(column_name="event_time", is_dttm=1, type="TIMESTAMP"),
        TableColumn(column_name="id", type="INTEGER"),
        TableColumn(column_name="dttm", type="INTEGER"),
        TableColumn(column_name="duration_ms", type="INTEGER"),
    ]

    return SqlaTable(
        table_name="test_table",
        columns=columns,
        metrics=[],
        main_dttm_col=None,
        database=Database(database_name="my_database", sqlalchemy_uri="sqlite://"),
    )


@with_config(
    {
        "SQLA_TABLE_MUTATOR": partial(
            apply_dttm_defaults,
            dttm_defaults={
                "main_dttm_col": "event_time",
                "dttm_columns": {"ds": {}, "event_time": {}},
            },
        )
    }
)
def test_main_dttm_col(mocker: MockerFixture, test_table: "SqlaTable") -> None:
    """
    Test the ``SQLA_TABLE_MUTATOR`` config.
    """
    mocker.patch(
        "superset.connectors.sqla.models.get_physical_table_metadata",
        return_value=[
            {"column_name": "ds", "type": "TIMESTAMP", "is_dttm": True},
            {"column_name": "event_time", "type": "TIMESTAMP", "is_dttm": True},
            {"column_name": "id", "type": "INTEGER", "is_dttm": False},
        ],
    )

    assert test_table.main_dttm_col is None
    test_table.fetch_metadata()
    assert test_table.main_dttm_col == "event_time"


@with_config(
    {
        "SQLA_TABLE_MUTATOR": partial(
            apply_dttm_defaults,
            dttm_defaults={
                "main_dttm_col": "nonexistent",
            },
        )
    }
)
def test_main_dttm_col_nonexistent(
    mocker: MockerFixture,
    test_table: "SqlaTable",
) -> None:
    """
    Test the ``SQLA_TABLE_MUTATOR`` config when main datetime column doesn't exist.
    """
    mocker.patch(
        "superset.connectors.sqla.models.get_physical_table_metadata",
        return_value=[
            {"column_name": "ds", "type": "TIMESTAMP", "is_dttm": True},
            {"column_name": "event_time", "type": "TIMESTAMP", "is_dttm": True},
            {"column_name": "id", "type": "INTEGER", "is_dttm": False},
        ],
    )

    assert test_table.main_dttm_col is None
    test_table.fetch_metadata()
    # fall back to ds
    assert test_table.main_dttm_col == "ds"


@with_config(
    {
        "SQLA_TABLE_MUTATOR": partial(
            apply_dttm_defaults,
            dttm_defaults={
                "main_dttm_col": "id",
            },
        )
    }
)
def test_main_dttm_col_nondttm(
    mocker: MockerFixture,
    test_table: "SqlaTable",
) -> None:
    """
    Test the ``SQLA_TABLE_MUTATOR`` config when main datetime column has wrong type.
    """
    mocker.patch(
        "superset.connectors.sqla.models.get_physical_table_metadata",
        return_value=[
            {"column_name": "ds", "type": "TIMESTAMP", "is_dttm": True},
            {"column_name": "event_time", "type": "TIMESTAMP", "is_dttm": True},
            {"column_name": "id", "type": "INTEGER", "is_dttm": False},
        ],
    )

    assert test_table.main_dttm_col is None
    test_table.fetch_metadata()
    # fall back to ds
    assert test_table.main_dttm_col == "ds"


@with_config(
    {
        "SQLA_TABLE_MUTATOR": partial(
            apply_dttm_defaults,
            dttm_defaults={
                "dttm_columns": {
                    "id": {"python_date_format": "epoch_ms"},
                    "dttm": {"python_date_format": "epoch_s"},
                },
            },
        )
    }
)
def test_python_date_format_by_column_name(
    mocker: MockerFixture,
    test_table: "SqlaTable",
) -> None:
    """
    Test the ``SQLA_TABLE_MUTATOR`` setting for "python_date_format".
    """
    mocker.patch(
        "superset.connectors.sqla.models.get_physical_table_metadata",
        return_value=[
            {"column_name": "id", "type": "INTEGER", "is_dttm": False},
            {"column_name": "dttm", "type": "INTEGER", "is_dttm": False},
        ],
    )

    test_table.fetch_metadata()

    id_col = [c for c in test_table.columns if c.column_name == "id"][0]
    assert id_col.is_dttm
    assert id_col.python_date_format == "epoch_ms"

    dttm_col = [c for c in test_table.columns if c.column_name == "dttm"][0]
    assert dttm_col.is_dttm
    assert dttm_col.python_date_format == "epoch_s"


@with_config(
    {
        "SQLA_TABLE_MUTATOR": partial(
            apply_dttm_defaults,
            dttm_defaults={
                "dttm_columns": {
                    "dttm": {"expression": "CAST(dttm as INTEGER)"},
                    "duration_ms": {"expression": "CAST(duration_ms as DOUBLE)"},
                },
            },
        )
    }
)
def test_expression_by_column_name(
    mocker: MockerFixture,
    test_table: "SqlaTable",
) -> None:
    """
    Test the ``SQLA_TABLE_MUTATOR`` setting for expression.
    """
    mocker.patch(
        "superset.connectors.sqla.models.get_physical_table_metadata",
        return_value=[
            {"column_name": "dttm", "type": "INTEGER", "is_dttm": False},
            {"column_name": "duration_ms", "type": "INTEGER", "is_dttm": False},
        ],
    )

    test_table.fetch_metadata()

    dttm_col = [c for c in test_table.columns if c.column_name == "dttm"][0]
    assert dttm_col.is_dttm
    assert dttm_col.expression == "CAST(dttm as INTEGER)"

    duration_ms_col = [c for c in test_table.columns if c.column_name == "duration_ms"][
        0
    ]
    assert duration_ms_col.is_dttm
    assert duration_ms_col.expression == "CAST(duration_ms as DOUBLE)"


@with_config(
    {
        "SQLA_TABLE_MUTATOR": partial(
            apply_dttm_defaults,
            dttm_defaults=FULL_DTTM_DEFAULTS_EXAMPLE,
        )
    }
)
def test_full_setting(
    mocker: MockerFixture,
    test_table: "SqlaTable",
) -> None:
    """
    Test the ``SQLA_TABLE_MUTATOR`` with full settings.
    """
    mocker.patch(
        "superset.connectors.sqla.models.get_physical_table_metadata",
        return_value=[
            {"column_name": "id", "type": "INTEGER", "is_dttm": False},
            {"column_name": "dttm", "type": "INTEGER", "is_dttm": False},
            {"column_name": "duration_ms", "type": "INTEGER", "is_dttm": False},
        ],
    )

    test_table.fetch_metadata()

    id_col = [c for c in test_table.columns if c.column_name == "id"][0]
    assert id_col.is_dttm
    assert id_col.python_date_format == "epoch_ms"
    assert id_col.expression == ""

    dttm_col = [c for c in test_table.columns if c.column_name == "dttm"][0]
    assert dttm_col.is_dttm
    assert dttm_col.python_date_format == "epoch_s"
    assert dttm_col.expression == "CAST(dttm as INTEGER)"


def test_sync_theme_logo_href() -> None:
    """
    Verify LOGO_TARGET_PATH is wired into a theme's brandLogoHref.

    THEME_DEFAULT is built before superset_config.py overrides load, so the link
    is re-synced afterwards via sync_theme_logo_href. A provided LOGO_TARGET_PATH
    must update brandLogoHref; None must leave the existing value untouched.
    """
    from copy import deepcopy

    from superset.config import sync_theme_logo_href, THEME_DEFAULT

    # A user-provided LOGO_TARGET_PATH propagates to the logo link.
    theme = deepcopy(THEME_DEFAULT)
    theme["token"]["brandLogoHref"] = "/"
    sync_theme_logo_href(theme, "https://custom.url")
    assert theme["token"]["brandLogoHref"] == "https://custom.url"

    # The default (None) leaves the existing link untouched.
    default_theme = deepcopy(THEME_DEFAULT)
    default_theme["token"]["brandLogoHref"] = "/"
    sync_theme_logo_href(default_theme, None)
    assert default_theme["token"]["brandLogoHref"] == "/"

    # A disabled theme (None) is a no-op rather than an error.
    sync_theme_logo_href(None, "https://custom.url")


def test_theme_default_logo_defaults() -> None:
    """With the shipped defaults, brandLogoHref is "/" and brandLogoUrl is APP_ICON."""
    from superset import config

    assert config.LOGO_TARGET_PATH is None
    assert config.THEME_DEFAULT["token"]["brandLogoHref"] == "/"
    assert config.THEME_DEFAULT["token"]["brandLogoUrl"] == config.APP_ICON


def test_smtp_ssl_server_auth_defaults_to_true() -> None:
    """
    The shipped default for SMTP_SSL_SERVER_AUTH validates the SMTP server's
    TLS certificate. Operators can still opt out by overriding it to False.
    """
    from superset import config

    assert config.SMTP_SSL_SERVER_AUTH is True


def _smtp_config(**overrides: Any) -> dict[str, Any]:
    """
    Build a minimal SMTP config dict for ``send_mime_email`` tests, with
    plaintext transport defaults; keyword ``overrides`` replace any key.
    """
    config = {
        "SMTP_HOST": "localhost",
        "SMTP_PORT": 25,
        "SMTP_USER": "",
        "SMTP_PASSWORD": "",
        "SMTP_STARTTLS": False,
        "SMTP_SSL": False,
        "SMTP_SSL_SERVER_AUTH": True,
    }
    config.update(overrides)
    return config


def test_send_mime_email_ssl_server_auth_passes_context(
    mocker: MockerFixture,
) -> None:
    """
    With SMTP_SSL and SMTP_SSL_SERVER_AUTH enabled, ``send_mime_email`` builds a
    default SSL context and threads it through to ``smtplib.SMTP_SSL`` so the
    server certificate is validated.
    """
    from email.mime.multipart import MIMEMultipart

    from superset.utils import core as utils

    create_default_context = mocker.patch(
        "superset.utils.core.ssl.create_default_context"
    )
    smtp_ssl = mocker.patch("smtplib.SMTP_SSL")
    smtp = mocker.patch("smtplib.SMTP")

    utils.send_mime_email(
        "from",
        ["to"],
        MIMEMultipart(),
        _smtp_config(SMTP_SSL=True, SMTP_SSL_SERVER_AUTH=True),
        dryrun=False,
    )

    create_default_context.assert_called_once_with()
    assert not smtp.called
    smtp_ssl.assert_called_once_with(
        "localhost", 25, context=create_default_context.return_value, timeout=30
    )


def test_send_mime_email_starttls_server_auth_passes_context(
    mocker: MockerFixture,
) -> None:
    """
    With STARTTLS and SMTP_SSL_SERVER_AUTH enabled, ``send_mime_email`` builds a
    default SSL context and threads it through to ``starttls`` so the server
    certificate is validated.
    """
    from email.mime.multipart import MIMEMultipart

    from superset.utils import core as utils

    create_default_context = mocker.patch(
        "superset.utils.core.ssl.create_default_context"
    )
    smtp = mocker.patch("smtplib.SMTP")

    utils.send_mime_email(
        "from",
        ["to"],
        MIMEMultipart(),
        _smtp_config(SMTP_STARTTLS=True, SMTP_SSL_SERVER_AUTH=True),
        dryrun=False,
    )

    create_default_context.assert_called_once_with()
    smtp.return_value.starttls.assert_called_once_with(
        context=create_default_context.return_value
    )


def test_send_mime_email_server_auth_disabled_skips_context(
    mocker: MockerFixture,
) -> None:
    """
    When SMTP_SSL_SERVER_AUTH is disabled no SSL context is built and ``None`` is
    passed through, preserving the opt-out (certificate validation skipped).
    """
    from email.mime.multipart import MIMEMultipart

    from superset.utils import core as utils

    create_default_context = mocker.patch(
        "superset.utils.core.ssl.create_default_context"
    )
    smtp_ssl = mocker.patch("smtplib.SMTP_SSL")

    utils.send_mime_email(
        "from",
        ["to"],
        MIMEMultipart(),
        _smtp_config(SMTP_SSL=True, SMTP_SSL_SERVER_AUTH=False),
        dryrun=False,
    )

    assert not create_default_context.called
    smtp_ssl.assert_called_once_with("localhost", 25, context=None, timeout=30)
