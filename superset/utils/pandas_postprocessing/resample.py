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
from typing import Optional, Union

import pandas as pd
from flask_babel import gettext as _

from superset.exceptions import InvalidPostProcessingError
from superset.utils.pandas_postprocessing.utils import RESAMPLE_METHOD

# Upper bound on the number of rows a resample may project. ``rule`` arrives
# through the post-processing ``options`` dict, which is not schema-validated;
# without a cap, upsampling a multi-day span to e.g. ``1ns`` projects ~1e14
# rows from a single request.
MAX_RESAMPLE_ROWS = 1_000_000


def resample(
    df: pd.DataFrame,
    rule: str,
    method: str,
    fill_value: Optional[Union[float, int]] = None,
) -> pd.DataFrame:
    """
    support upsampling in resample

    :param df: DataFrame to resample.
    :param rule: The offset string representing target conversion.
    :param method: How to fill the NaN value after resample.
    :param fill_value: What values do fill missing.
    :return: DataFrame after resample
    :raises InvalidPostProcessingError: If the request in incorrect
    """
    if not isinstance(df.index, pd.DatetimeIndex):
        raise InvalidPostProcessingError(_("Resample operation requires DatetimeIndex"))
    if method not in RESAMPLE_METHOD:
        raise InvalidPostProcessingError(
            _("Resample method should be in ") + ", ".join(RESAMPLE_METHOD) + "."
        )

    if len(df):
        try:
            step = pd.Timedelta(pd.tseries.frequencies.to_offset(rule))
        except ValueError:
            # Non-fixed frequencies (month, quarter, year) have no fixed
            # Timedelta; their projected row count is bounded by the span in
            # days and needs no cap. Invalid rules fail in ``df.resample``.
            step = None
        if step is not None and step.value > 0:
            span = df.index.max() - df.index.min()
            # pandas snaps the first resample bin to the nearest frequency
            # multiple at or before the observed span (and may extend the
            # last bin similarly), so the actual bin count can exceed a
            # naive span/step projection by one. Add a margin so the check
            # cannot under-count due to that alignment.
            projected_rows = span.value // step.value + 2
            if projected_rows > MAX_RESAMPLE_ROWS:
                raise InvalidPostProcessingError(
                    _(
                        "Resample rule would project %(rows)s rows, "
                        "exceeding the limit of %(max)s rows",
                        rows=projected_rows,
                        max=MAX_RESAMPLE_ROWS,
                    )
                )

    if method == "asfreq" and fill_value is not None:
        _df = df.resample(rule).asfreq(fill_value=fill_value)
        _df = _df.fillna(fill_value)
    elif method == "linear":
        _df = df.resample(rule).interpolate()
    else:
        _df = getattr(df.resample(rule), method)()
        if method in ("ffill", "bfill"):
            _df = getattr(_df, method)()
    return _df
