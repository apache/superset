import io
from typing import Any

import pandas as pd

from superset.common.chart_data import ChartDataResultFormat


def df_to_excel(
    df: pd.DataFrame,
    excel_format: ChartDataResultFormat = ChartDataResultFormat.XLSX,
    **kwargs: Any
) -> bytes:
    output = io.BytesIO()
    engine = "xlwt" if excel_format == ChartDataResultFormat.XLS else "xlsxwriter"
    with pd.ExcelWriter(output, engine=engine) as writer:
        df.to_excel(writer, **kwargs)
    return output.getvalue()
