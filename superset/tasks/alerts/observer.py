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

import logging
from datetime import datetime
from typing import Optional

import pandas as pd
from sqlalchemy.orm import Session

from superset import jinja_context
from superset.models.alerts import Alert, SQLObservation

logger = logging.getLogger("tasks.email_reports")


# Session needs to be passed along in the celery workers and db.session cannot be used.
# For more info see: https://github.com/apache/incubator-superset/issues/10530
def observe(alert_id: int, session: Session) -> Optional[str]:
    """Collect observations for the alert.
    Returns an error message if the observer value was not valid
    """

    alert = session.query(Alert).filter_by(id=alert_id).one()

    value = None

    tp = jinja_context.get_template_processor(database=alert.database)
    rendered_sql = tp.process_template(alert.sql)
    df = alert.database.get_df(rendered_sql)

    error_msg = validate_observer_result(df, alert.id, alert.label)

    if not error_msg and not df.empty and df.to_records()[0][1] is not None:
        value = float(df.to_records()[0][1])

    observation = SQLObservation(
        alert_id=alert_id, dttm=datetime.utcnow(), value=value, error_msg=error_msg,
    )

    session.add(observation)
    session.commit()

    return error_msg


def validate_observer_result(
    sql_result: pd.DataFrame, alert_id: int, alert_label: str
) -> Optional[str]:
    """
    Verifies if a DataFrame SQL query result to see if
    it contains a valid value for a SQLObservation.
    Returns an error message if the result is invalid.
    """
    try:
        if sql_result.empty:
            # empty results are used for the not null validator
            return None

        rows = sql_result.to_records()

        assert (
            len(rows) == 1
        ), f"Observer for alert <{alert_id}:{alert_label}> returned more than 1 row"

        assert (
            len(rows[0]) == 2
        ), f"Observer for alert <{alert_id}:{alert_label}> returned more than 1 column"

        if rows[0][1] is None:
            return None

        float(rows[0][1])

    except AssertionError as error:
        return str(error)
    except (TypeError, ValueError):
        return (
            f"Observer for alert <{alert_id}:{alert_label}> returned a non-number value"
        )

    return None
