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
"""Pandas utilities for data processing."""

import pandas as pd


def detect_datetime_format(series: pd.Series, sample_size: int = 100) -> str | None:
    """
    Detect the datetime format from a sample of the series.

    :param series: The pandas Series to analyze
    :param sample_size: Number of rows to sample for format detection
    :return: Detected format string or None if no consistent format found
    """
    # Most common formats first for performance
    common_formats = [
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%dT%H:%M:%SZ",
        "%Y-%m-%dT%H:%M:%S.%f",
        "%Y-%m-%dT%H:%M:%S.%fZ",
        "%m/%d/%Y",
        "%d/%m/%Y",
        "%Y/%m/%d",
        "%m/%d/%Y %H:%M:%S",
        "%d/%m/%Y %H:%M:%S",
        "%m-%d-%Y",
        "%d-%m-%Y",
        "%Y%m%d",
    ]

    # Get non-null sample
    sample = series.dropna().head(sample_size)
    if sample.empty:
        return None

    # Convert to string if not already
    if not pd.api.types.is_string_dtype(sample):
        sample = sample.astype(str)

    # Try each format
    for fmt in common_formats:
        try:
            # Test on small sample first
            test_sample = sample.head(10)
            pd.to_datetime(test_sample, format=fmt, errors="raise")
            # If successful, verify on larger sample
            pd.to_datetime(sample, format=fmt, errors="raise")
            return fmt
        except (ValueError, TypeError):
            continue

    return None
