from contextlib2 import contextmanager

from superset.utils.dates import now_as_float


@contextmanager
def stats_timing(stats_key, stats_logger):
    """Provide a transactional scope around a series of operations."""
    start_ts = now_as_float()
    try:
        yield start_ts
    except Exception as e:
        raise e
    finally:
        stats_logger.timing(stats_key, now_as_float() - start_ts)
