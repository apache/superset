import pandas as pd
import pytest
from superset.utils.cohort import calculate_cohort_retention

def test_cohort_empty_dataframe() -> None:
    df = pd.DataFrame()
    assert calculate_cohort_retention(df).empty
def test_cohort_base_size() -> None:
    data = {
        "user_id": [1, 2],
        "cohort_month": ["2026-01", "2026-01"],
        "activity_month": ["2026-01", "2026-01"]
    }
    result = calculate_cohort_retention(pd.DataFrame(data))
    assert result.loc[pd.Timestamp("2026-01-01"), 0] == 2

def test_cohort_deduplicate_base() -> None:
    data = {
        "user_id": [1, 1],
        "cohort_month": ["2026-01", "2026-01"],
        "activity_month": ["2026-01", "2026-01"]
    }
    result = calculate_cohort_retention(pd.DataFrame(data))
    assert result.loc[pd.Timestamp("2026-01-01"), 0] == 1

def test_cohort_retention_percentage() -> None:
    data = {
        "user_id": [1, 2, 1],
        "cohort_month": ["2026-01", "2026-01", "2026-01"],
        "activity_month": ["2026-01", "2026-01", "2026-02"]
    }
    result = calculate_cohort_retention(pd.DataFrame(data))
    assert result.loc[pd.Timestamp("2026-01-01"), 1] == 50.0

def test_cohort_active_deduplication() -> None:
    data = {
        "user_id": [1, 1, 1],
        "cohort_month": ["2026-01", "2026-01", "2026-01"],
        "activity_month": ["2026-01", "2026-02", "2026-02"]
    }
    result = calculate_cohort_retention(pd.DataFrame(data))
    assert result.loc[pd.Timestamp("2026-01-01"), 1] == 100.0

def test_cohort_multiple_simultaneous() -> None:
    data = {
        "user_id": [1, 1, 2, 2],
        "cohort_month": ["2026-01", "2026-01", "2026-02", "2026-02"],
        "activity_month": ["2026-01", "2026-03", "2026-02", "2026-03"]
    }
    result = calculate_cohort_retention(pd.DataFrame(data))
    assert result.loc[pd.Timestamp("2026-01-01"), 2] == 100.0
    assert result.loc[pd.Timestamp("2026-02-01"), 1] == 100.0