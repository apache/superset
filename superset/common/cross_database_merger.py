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
"""Cross-database DataFrame merger for the Dataset Relationship Engine.

When two related datasets live in different databases, SQL JOINs cannot be
used.  This module provides :class:`CrossDatabaseMerger`, which executes the
merge at the **application level** using Pandas, respecting memory limits,
column-name conflicts, and configurable join semantics.

Typical usage::

    from superset.common.cross_database_merger import CrossDatabaseMerger

    merger = CrossDatabaseMerger(max_rows=100_000, timeout_seconds=30)
    result_df = merger.merge_dataframes(
        source_df=orders_df,
        target_df=customers_df,
        column_pairs=[("customer_id", "id")],
        join_type="LEFT",
        source_prefix="orders",
        target_prefix="customers",
    )
"""

from __future__ import annotations

import logging
import signal
import time
from dataclasses import dataclass, field
from typing import Optional

import pandas as pd

from superset.exceptions import SupersetException

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------


class CrossDatabaseMergeError(SupersetException):
    """Base exception for cross-database merge failures."""


class CrossDatabaseMergeMemoryError(CrossDatabaseMergeError):
    """Raised when the estimated result exceeds the configured row limit."""


class CrossDatabaseMergeTimeoutError(CrossDatabaseMergeError):
    """Raised when the merge operation exceeds the configured timeout."""


# ---------------------------------------------------------------------------
# Helper dataclass
# ---------------------------------------------------------------------------

JOIN_TYPE_MAP: dict[str, str] = {
    "INNER": "inner",
    "LEFT": "left",
    "RIGHT": "right",
    "FULL": "outer",
    "CROSS": "cross",
    "LEFT OUTER": "left",
    "RIGHT OUTER": "right",
    "FULL OUTER": "outer",
}

VALID_JOIN_TYPES = frozenset(JOIN_TYPE_MAP.keys())


@dataclass
class MergeResult:
    """Encapsulates the output of a cross-database merge."""

    df: pd.DataFrame
    row_count: int
    duration_ms: float
    source_rows: int
    target_rows: int
    join_type: str
    column_pairs: list[tuple[str, str]]
    warnings: list[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Main class
# ---------------------------------------------------------------------------


class CrossDatabaseMerger:
    """Merges DataFrames from different databases using Pandas.

    This class is the core of the cross-database relationship resolution.
    It receives two DataFrames (source and target), the column pairs that
    define the join condition, and the desired join type, then performs the
    merge while enforcing memory and timeout safeguards.

    Parameters
    ----------
    max_rows : int
        Maximum number of rows allowed in the merged result.  When the
        *estimated* result exceeds this limit the merge is aborted **before**
        allocating memory.  Defaults to ``100_000``.
    timeout_seconds : int
        Maximum wall-clock seconds allowed for a single merge operation.
        A value of ``0`` disables the timeout.  Defaults to ``30``.
    """

    def __init__(
        self,
        max_rows: int = 100_000,
        timeout_seconds: int = 30,
    ) -> None:
        self.max_rows = max_rows
        self.timeout_seconds = timeout_seconds

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def merge_dataframes(
        self,
        source_df: pd.DataFrame,
        target_df: pd.DataFrame,
        column_pairs: list[tuple[str, str]],
        join_type: str = "LEFT",
        source_prefix: Optional[str] = None,
        target_prefix: Optional[str] = None,
    ) -> MergeResult:
        """Execute a Pandas merge between *source_df* and *target_df*.

        Parameters
        ----------
        source_df:
            The "left" DataFrame (from the source dataset).
        target_df:
            The "right" DataFrame (from the target dataset).
        column_pairs:
            List of ``(source_column, target_column)`` tuples that form the
            ON clause.
        join_type:
            SQL-style join type (``INNER``, ``LEFT``, ``RIGHT``, ``FULL``,
            ``CROSS``).  Case-insensitive; mapped to Pandas ``how`` parameter.
        source_prefix:
            Optional prefix added to overlapping column names from the source
            DataFrame.
        target_prefix:
            Optional prefix added to overlapping column names from the target
            DataFrame.

        Returns
        -------
        MergeResult
            A dataclass with the merged DataFrame and diagnostic metadata.

        Raises
        ------
        CrossDatabaseMergeError
            On invalid parameters.
        CrossDatabaseMergeMemoryError
            When the estimated result exceeds *max_rows*.
        CrossDatabaseMergeTimeoutError
            When the merge takes longer than *timeout_seconds*.
        """
        start = time.monotonic()

        # -- Validate inputs ------------------------------------------------
        join_type_upper = join_type.upper().strip()
        if join_type_upper not in VALID_JOIN_TYPES:
            raise CrossDatabaseMergeError(
                f"Unsupported join type '{join_type}'. "
                f"Valid types: {sorted(VALID_JOIN_TYPES)}"
            )
        pandas_how = JOIN_TYPE_MAP[join_type_upper]

        if not column_pairs and pandas_how != "cross":
            raise CrossDatabaseMergeError(
                "At least one column pair is required for non-CROSS joins."
            )

        self._validate_columns(source_df, target_df, column_pairs)

        # -- Memory guard (pre-merge estimation) ----------------------------
        self._check_memory_guard(source_df, target_df, pandas_how)

        # -- Resolve column-name conflicts ----------------------------------
        source_df, target_df, suffixes = self._resolve_column_conflicts(
            source_df,
            target_df,
            column_pairs,
            source_prefix,
            target_prefix,
        )

        # -- Execute merge --------------------------------------------------
        logger.info(
            "Cross-database merge: %s JOIN on %s | source=%d rows, target=%d rows",
            join_type_upper,
            column_pairs,
            len(source_df),
            len(target_df),
        )

        left_on = [pair[0] for pair in column_pairs] if pandas_how != "cross" else None
        right_on = [pair[1] for pair in column_pairs] if pandas_how != "cross" else None

        try:
            merged_df = self._merge_with_timeout(
                source_df,
                target_df,
                how=pandas_how,
                left_on=left_on,
                right_on=right_on,
                suffixes=suffixes,
            )
        except CrossDatabaseMergeTimeoutError:
            raise
        except Exception as ex:
            raise CrossDatabaseMergeError(
                f"Merge operation failed: {ex}"
            ) from ex

        # -- Post-merge row-count check ------------------------------------
        warnings: list[str] = []
        if len(merged_df) > self.max_rows:
            logger.warning(
                "Merged result has %d rows, truncating to %d",
                len(merged_df),
                self.max_rows,
            )
            merged_df = merged_df.head(self.max_rows)
            warnings.append(
                f"Result truncated from {len(merged_df)} to {self.max_rows} rows."
            )

        duration_ms = (time.monotonic() - start) * 1000
        logger.info(
            "Cross-database merge completed: %d rows in %.1fms",
            len(merged_df),
            duration_ms,
        )

        return MergeResult(
            df=merged_df,
            row_count=len(merged_df),
            duration_ms=duration_ms,
            source_rows=len(source_df),
            target_rows=len(target_df),
            join_type=join_type_upper,
            column_pairs=column_pairs,
            warnings=warnings,
        )

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _validate_columns(
        source_df: pd.DataFrame,
        target_df: pd.DataFrame,
        column_pairs: list[tuple[str, str]],
    ) -> None:
        """Ensure all referenced columns exist in their respective DataFrames."""
        for src_col, tgt_col in column_pairs:
            if src_col not in source_df.columns:
                raise CrossDatabaseMergeError(
                    f"Source column '{src_col}' not found. "
                    f"Available: {list(source_df.columns)}"
                )
            if tgt_col not in target_df.columns:
                raise CrossDatabaseMergeError(
                    f"Target column '{tgt_col}' not found. "
                    f"Available: {list(target_df.columns)}"
                )

    def _check_memory_guard(
        self,
        source_df: pd.DataFrame,
        target_df: pd.DataFrame,
        pandas_how: str,
    ) -> None:
        """Estimate the worst-case row count and abort early if too large.

        For INNER/LEFT/RIGHT joins we use a conservative heuristic; for CROSS
        joins the exact cartesian product size is known.
        """
        src_rows = len(source_df)
        tgt_rows = len(target_df)

        if pandas_how == "cross":
            estimated = src_rows * tgt_rows
        else:
            # Conservative estimate: the larger of the two sides.
            # A real cartesian explosion will be caught post-merge.
            estimated = max(src_rows, tgt_rows)

        if estimated > self.max_rows:
            raise CrossDatabaseMergeMemoryError(
                f"Estimated merge result ({estimated:,} rows) exceeds the "
                f"configured limit of {self.max_rows:,} rows.  "
                f"Source has {src_rows:,} rows, target has {tgt_rows:,} rows."
            )

    @staticmethod
    def _resolve_column_conflicts(
        source_df: pd.DataFrame,
        target_df: pd.DataFrame,
        column_pairs: list[tuple[str, str]],
        source_prefix: Optional[str],
        target_prefix: Optional[str],
    ) -> tuple[pd.DataFrame, pd.DataFrame, tuple[str, str]]:
        """Build suffixes for overlapping columns and return (possibly copied)
        DataFrames with join-key columns harmonised.

        If explicit prefixes are supplied they are used as Pandas suffixes;
        otherwise sensible defaults are generated.
        """
        join_src_cols = {pair[0] for pair in column_pairs}
        join_tgt_cols = {pair[1] for pair in column_pairs}

        overlapping = (
            set(source_df.columns) & set(target_df.columns)
        ) - join_src_cols - join_tgt_cols

        if overlapping:
            logger.debug("Overlapping columns detected: %s", overlapping)

        suffix_left = f"_{source_prefix}" if source_prefix else "_source"
        suffix_right = f"_{target_prefix}" if target_prefix else "_target"

        return source_df, target_df, (suffix_left, suffix_right)

    def _merge_with_timeout(
        self,
        left: pd.DataFrame,
        right: pd.DataFrame,
        how: str,
        left_on: Optional[list[str]],
        right_on: Optional[list[str]],
        suffixes: tuple[str, str],
    ) -> pd.DataFrame:
        """Execute the Pandas merge, aborting if the timeout is exceeded.

        On platforms that support ``SIGALRM`` (Unix) a signal-based timeout is
        used.  Otherwise the timeout is enforced **after** the merge completes
        (best-effort).
        """
        if self.timeout_seconds <= 0:
            return self._do_merge(left, right, how, left_on, right_on, suffixes)

        # Try signal-based timeout (Unix only)
        if hasattr(signal, "SIGALRM"):
            old_handler = signal.signal(signal.SIGALRM, self._timeout_handler)
            signal.alarm(self.timeout_seconds)
            try:
                result = self._do_merge(left, right, how, left_on, right_on, suffixes)
            except CrossDatabaseMergeTimeoutError:
                raise
            finally:
                signal.alarm(0)
                signal.signal(signal.SIGALRM, old_handler)
            return result

        # Fallback: measure elapsed time after merge
        start = time.monotonic()
        result = self._do_merge(left, right, how, left_on, right_on, suffixes)
        elapsed = time.monotonic() - start
        if elapsed > self.timeout_seconds:
            raise CrossDatabaseMergeTimeoutError(
                f"Merge took {elapsed:.1f}s, exceeding the "
                f"{self.timeout_seconds}s timeout."
            )
        return result

    @staticmethod
    def _do_merge(
        left: pd.DataFrame,
        right: pd.DataFrame,
        how: str,
        left_on: Optional[list[str]],
        right_on: Optional[list[str]],
        suffixes: tuple[str, str],
    ) -> pd.DataFrame:
        """Thin wrapper around ``pd.merge``."""
        kwargs: dict = {
            "how": how,
            "suffixes": suffixes,
        }
        if left_on and right_on:
            kwargs["left_on"] = left_on
            kwargs["right_on"] = right_on

        return pd.merge(left, right, **kwargs)

    @staticmethod
    def _timeout_handler(signum: int, frame: object) -> None:  # noqa: ARG004
        raise CrossDatabaseMergeTimeoutError("Cross-database merge timed out.")
