from sqlalchemy.util import decorator


@decorator
def provide_metadata(fn, *args, **kw):
    """Provide bound MetaData for a single test, dropping afterwards."""

    from . import config
    from sqlalchemy import schema

    metadata = schema.MetaData(config.db)
    self = args[0]
    prev_meta = getattr(self, 'metadata', None)
    self.metadata = metadata
    try:
        return fn(*args, **kw)
    finally:
        metadata.drop_all()
        self.metadata = prev_meta
