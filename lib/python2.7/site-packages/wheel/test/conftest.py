"""
pytest local configuration plug-in
"""

import gc
import warnings

import pytest

@pytest.yield_fixture(scope='function', autouse=True)
def error_on_ResourceWarning():
    """This fixture captures ResourceWarning's and reports an "error"
    describing the file handles left open.
    
    This is shown regardless of how successful the test was, if a test fails
    and leaves files open then those files will be reported.  Ideally, even
    those files should be closed properly after a test failure or exception.

    Since only Python 3 and PyPy3 have ResourceWarning's, this context will
    have no effect when running tests on Python 2 or PyPy.

    Because of autouse=True, this function will be automatically enabled for
    all test_* functions in this module.

    This code is primarily based on the examples found here:
    https://stackoverflow.com/questions/24717027/convert-python-3-resourcewarnings-into-exception
    """
    try:
        ResourceWarning
    except NameError:
        # Python 2, PyPy
        yield
        return
    # Python 3, PyPy3
    with warnings.catch_warnings(record=True) as caught:
        warnings.resetwarnings() # clear all filters
        warnings.simplefilter('ignore') # ignore all
        warnings.simplefilter('always', ResourceWarning) # add filter
        yield # run tests in this context
        gc.collect() # run garbage collection (for pypy3)
        if not caught:
            return
        pytest.fail('The following file descriptors were not closed properly:\n' +
                    '\n'.join((str(warning.message) for warning in caught)),
                    pytrace=False)
