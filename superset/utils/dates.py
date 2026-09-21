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
from datetime import datetime, timezone

import pytz

EPOCH = datetime(1970, 1, 1)


def datetime_to_epoch(dttm: datetime) -> float:
    """Convert datetime to milliseconds to epoch"""
    if dttm.tzinfo:
        dttm = dttm.astimezone(pytz.utc)
        epoch_with_tz = pytz.utc.localize(EPOCH)
        return (dttm - epoch_with_tz).total_seconds() * 1000
    return (dttm - EPOCH).total_seconds() * 1000


def now_as_float() -> float:
    return datetime_to_epoch(naive_utcnow())


def naive_utcnow() -> datetime:
    """Naive-UTC now — the single clock for naive-UTC datetime columns.

    Continuum stores ``version_transaction.issued_at`` tz-naive in UTC, and
    the task timestamp columns (``started_at``, ``ended_at``,
    ``subscribed_at``) are likewise naive ``DateTime`` columns holding UTC.
    Writing a tz-aware value to such a column lets some DB drivers convert
    it to the session-local timezone, skewing every duration computed from
    it by the local UTC offset — so the offset is dropped here, once, before
    the value reaches the DB. Every writer and comparator of these columns
    (the baseline capture stamp, the retention prune's cutoff, the task
    lifecycle stamps) must derive its value from this one helper so their
    agreement is structural, not comment-enforced. Callers in different
    processes still read their own host's wall clock — the guarantee is a
    shared UTC reference and derivation, not cross-process monotonic
    ordering.
    """
    return datetime.now(timezone.utc).replace(tzinfo=None)
