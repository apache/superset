import logging
from datetime import datetime
from typing import Dict, Optional

import numpy as np
import pandas as pd

from superset import db
from superset.models.alerts import SQLObservation, SQLObserver
from superset.sql_parse import ParsedQuery

logger = logging.getLogger("tasks.email_reports")


def observe(alert_id: int) -> Dict[str, str]:
    """
    Runs the SQL query in an alert's SQLObserver and then
    stores the result in a SQLObservation.
    Returns the observer sql statement and an error message if there was any
    """

    sql_observer = db.session.query(SQLObserver).filter_by(alert_id=alert_id).one()

    result = {"sql": sql_observer.sql}
    value = None
    valid_result = True

    parsed_query = ParsedQuery(sql_observer.sql)
    sql = parsed_query.stripped()
    df = sql_observer.database.get_df(sql)

    result["error_msg"] = check_observer_result(df, sql_observer.id, sql_observer.name)

    if result["error_msg"]:
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

    return result


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
