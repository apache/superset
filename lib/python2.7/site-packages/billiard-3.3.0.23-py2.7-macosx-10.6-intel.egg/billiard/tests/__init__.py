from __future__ import absolute_import

import atexit


def teardown():
    # Workaround for multiprocessing bug where logging
    # is attempted after global already collected at shutdown.
    cancelled = set()
    try:
        import multiprocessing.util
        cancelled.add(multiprocessing.util._exit_function)
    except (AttributeError, ImportError):
        pass

    try:
        atexit._exithandlers[:] = [
            e for e in atexit._exithandlers if e[0] not in cancelled
        ]
    except AttributeError:
        pass
