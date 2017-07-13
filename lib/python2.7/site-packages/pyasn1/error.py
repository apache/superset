#
# This file is part of pyasn1 software.
#
# Copyright (c) 2005-2017, Ilya Etingof <etingof@gmail.com>
# License: http://pyasn1.sf.net/license.html
#


class PyAsn1Error(Exception):
    pass


class ValueConstraintError(PyAsn1Error):
    pass


class SubstrateUnderrunError(PyAsn1Error):
    pass
