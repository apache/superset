from __future__ import absolute_import

import sys

from os.path import basename

from . import maybe_patch_concurrency

__all__ = ['main']

DEPRECATED_FMT = """
The {old!r} command is deprecated, please use {new!r} instead:

$ {new_argv}

"""


def _warn_deprecated(new):
    print(DEPRECATED_FMT.format(
        old=basename(sys.argv[0]), new=new,
        new_argv=' '.join([new] + sys.argv[1:])),
    )


def main():
    if 'multi' not in sys.argv:
        maybe_patch_concurrency()
    from celery.bin.celery import main
    main()


def _compat_worker():
    maybe_patch_concurrency()
    _warn_deprecated('celery worker')
    from celery.bin.worker import main
    main()


def _compat_multi():
    _warn_deprecated('celery multi')
    from celery.bin.multi import main
    main()


def _compat_beat():
    maybe_patch_concurrency()
    _warn_deprecated('celery beat')
    from celery.bin.beat import main
    main()


if __name__ == '__main__':  # pragma: no cover
    main()
