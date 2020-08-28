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

import numpy as np
import pandas as pd

from superset import db
from superset.models.alerts import SQLObservation, SQLObserver
from superset.sql_parse import ParsedQuery

logger = logging.getLogger("tasks.email_reports")


def observe(alert_id: int) -> Optional[str]:
    """
    Runs the SQL query in an alert's SQLObserver and then
    stores the result in a SQLObservation.
    Returns an error message if the observer value was not valid
    """

    sql_observer = db.session.query(SQLObserver).filter_by(alert_id=alert_id).one()

    value = None
    valid_result = True

    parsed_query = ParsedQuery(sql_observer.sql)
    sql = parsed_query.stripped()
    df = sql_observer.database.get_df(sql)

    error_msg = check_observer_result(df, sql_observer.id, sql_observer.name)

    if error_msg:
        valid_result = False
    else:
        value = float(df.to_records()[0][1])

    observation = SQLObservation(
        observer_id=sql_observer.id,
        alert_id=alert_id,
        dttm=datetime.utcnow(),
        value=value,
        valid_result=valid_result,
    )

    db.session.add(observation)
    db.session.commit()

    return error_msg


def check_observer_result(
    sql_result: pd.DataFrame, observer_id: int, observer_name: str
) -> Optional[str]:
    """
    Verifies if a DataFrame SQL query result to see if
    it contains a valid value for a SQLObservation.
    Returns an error message if the result is invalid.
    """
    error_msg = None

    if sql_result.empty:
        return f"Observer <{observer_id}:{observer_name}> returned no rows"

    try:
        rows = sql_result.to_records()

        assert (
            len(rows) == 1
        ), f"Observer <{observer_id}:{observer_name}> returned more than 1 row"

        assert (
            len(rows[0]) == 2
        ), f"Observer <{observer_id}:{observer_name}> returned more than 1 column"

        assert (
            float(rows[0][1]) != np.nan
        ), f"Observer <{observer_id}:{observer_name}> returned a NULL value"

    except AssertionError as error:
        error_msg = str(error)
    except (TypeError, ValueError):
        error_msg = (
            f"Observer <{observer_id}:{observer_name}> returned a non-number value"
        )

    return error_msg
