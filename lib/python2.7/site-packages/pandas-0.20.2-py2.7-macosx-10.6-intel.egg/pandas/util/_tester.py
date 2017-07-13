"""
Entrypoint for testing from the top-level namespace
"""
import os
import sys

PKG = os.path.dirname(os.path.dirname(__file__))


try:
    import pytest
except ImportError:
    def test():
        raise ImportError("Need pytest>=3.0 to run tests")
else:
    def test(extra_args=None):
        cmd = ['--skip-slow', '--skip-network']
        if extra_args:
            if not isinstance(extra_args, list):
                extra_args = [extra_args]
            cmd = extra_args
        cmd += [PKG]
        print("running: pytest {}".format(' '.join(cmd)))
        sys.exit(pytest.main(cmd))


__all__ = ['test']
