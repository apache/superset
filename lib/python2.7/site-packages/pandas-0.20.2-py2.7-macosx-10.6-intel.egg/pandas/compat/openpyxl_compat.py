"""
Detect incompatible version of OpenPyXL

GH7169
"""

from distutils.version import LooseVersion

start_ver = '1.6.1'
stop_ver = '2.0.0'


def is_compat(major_ver=1):
    """Detect whether the installed version of openpyxl is supported

    Parameters
    ----------
    ver : int
        1 requests compatibility status among the 1.x.y series
        2 requests compatibility status of 2.0.0 and later
    Returns
    -------
    compat : bool
        ``True`` if openpyxl is installed and is a compatible version.
        ``False`` otherwise.
    """
    import openpyxl
    ver = LooseVersion(openpyxl.__version__)
    if major_ver == 1:
        return LooseVersion(start_ver) <= ver < LooseVersion(stop_ver)
    elif major_ver == 2:
        return LooseVersion(stop_ver) <= ver
    else:
        raise ValueError('cannot test for openpyxl compatibility with ver {0}'
                         .format(major_ver))
