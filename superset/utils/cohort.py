from __future__ import annotations
import pandas as pd

def calculate_cohort_retention(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return pd.DataFrame()

    df["cohort_month"] = pd.to_datetime(df["cohort_month"])
    df["activity_month"] = pd.to_datetime(df["activity_month"])
    df["period"] = (df["activity_month"].dt.year - df["cohort_month"].dt.year) * 12 + (
        df["activity_month"].dt.month - df["cohort_month"].dt.month
    )

    cohort_group = df.groupby(["cohort_month", "period"])["user_id"].nunique().unstack(fill_value=0)
    cohort_sizes = cohort_group[0]

    retention_matrix = cohort_group.divide(cohort_sizes, axis=0) * 100

    retention_matrix[0] = cohort_sizes

    return retention_matrix.round(1)