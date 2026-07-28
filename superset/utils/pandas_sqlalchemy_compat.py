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
"""Compatibility shim letting pandas >= 2.2 use SQLAlchemy 1.4 engines.

pandas 2.2 raised its advertised minimum SQLAlchemy version to 2.0 as a
support-policy change. When an older SQLAlchemy is installed, pandas does not
fail loudly: ``pandas.io.sql`` silently pretends SQLAlchemy is absent, treats
Engine/Connection arguments as raw DBAPI connections, and falls back to its
sqlite-only code path, breaking every ``DataFrame.to_sql`` / ``read_sql``
call site (dataset uploads, example data loading, annotation queries, filter
values).

The pandas SQL layer itself still works with SQLAlchemy 1.4 because it only
uses the API subset common to SQLAlchemy 1.4 and 2.x. Lowering the advertised
minimum back to the pandas 2.1 value restores the working behavior.

This module is obsolete once Superset requires SQLAlchemy >= 2; at that point
the patch becomes a no-op and the module (and its call site in
``superset/__init__.py``) can be deleted.
"""

import logging

import sqlalchemy
from packaging.version import Version

logger = logging.getLogger(__name__)

# The last pandas release line to support SQLAlchemy 1.4 (pandas 2.1)
# required at least this version.
_SQLALCHEMY_MINIMUM = "1.4.16"


def restore_pandas_sqlalchemy_support() -> None:
    """Lower pandas' advertised SQLAlchemy minimum so 1.4 engines work.

    Only applies when the installed SQLAlchemy predates 2.0 and pandas
    advertises a 2.x minimum; in every other combination this is a no-op.
    Safe to call multiple times.
    """
    if Version(sqlalchemy.__version__) >= Version("2.0.0"):
        # pandas supports SQLAlchemy 2.x natively; nothing to patch.
        return

    try:
        from pandas.compat import _optional
    except ImportError:
        # The private module moved in a newer pandas; SQL IO with a pre-2.0
        # SQLAlchemy will misbehave, so make the situation diagnosable.
        logger.warning(
            "Could not adjust pandas' minimum SQLAlchemy version; "
            "DataFrame.to_sql/read_sql may not accept SQLAlchemy %s engines",
            sqlalchemy.__version__,
        )
        return

    advertised = _optional.VERSIONS.get("sqlalchemy")
    if advertised and Version(advertised) > Version(_SQLALCHEMY_MINIMUM):
        _optional.VERSIONS["sqlalchemy"] = _SQLALCHEMY_MINIMUM
        logger.debug(
            "Lowered pandas' minimum SQLAlchemy version from %s to %s so "
            "pandas SQL IO keeps working with the installed SQLAlchemy %s",
            advertised,
            _SQLALCHEMY_MINIMUM,
            sqlalchemy.__version__,
        )
