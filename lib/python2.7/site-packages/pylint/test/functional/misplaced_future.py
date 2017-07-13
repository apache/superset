"""Test that __future__ is not the first statement after the docstring."""
import collections
from __future__ import print_function # [misplaced-future]
from __future__ import with_statement

DATA = collections
