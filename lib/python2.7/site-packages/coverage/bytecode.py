# Licensed under the Apache License: http://www.apache.org/licenses/LICENSE-2.0
# For details: https://bitbucket.org/ned/coveragepy/src/default/NOTICE.txt

"""Bytecode manipulation for coverage.py"""

import types


class CodeObjects(object):
    """Iterate over all the code objects in `code`."""
    def __init__(self, code):
        self.stack = [code]

    def __iter__(self):
        while self.stack:
            # We're going to return the code object on the stack, but first
            # push its children for later returning.
            code = self.stack.pop()
            for c in code.co_consts:
                if isinstance(c, types.CodeType):
                    self.stack.append(c)
            yield code
