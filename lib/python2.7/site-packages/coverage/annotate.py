# Licensed under the Apache License: http://www.apache.org/licenses/LICENSE-2.0
# For details: https://bitbucket.org/ned/coveragepy/src/default/NOTICE.txt

"""Source file annotation for coverage.py."""

import io
import os
import re

from coverage.files import flat_rootname
from coverage.misc import isolate_module
from coverage.report import Reporter

os = isolate_module(os)


class AnnotateReporter(Reporter):
    """Generate annotated source files showing line coverage.

    This reporter creates annotated copies of the measured source files. Each
    .py file is copied as a .py,cover file, with a left-hand margin annotating
    each line::

        > def h(x):
        -     if 0:   #pragma: no cover
        -         pass
        >     if x == 1:
        !         a = 1
        >     else:
        >         a = 2

        > h(2)

    Executed lines use '>', lines not executed use '!', lines excluded from
    consideration use '-'.

    """

    def __init__(self, coverage, config):
        super(AnnotateReporter, self).__init__(coverage, config)
        self.directory = None

    blank_re = re.compile(r"\s*(#|$)")
    else_re = re.compile(r"\s*else\s*:\s*(#|$)")

    def report(self, morfs, directory=None):
        """Run the report.

        See `coverage.report()` for arguments.

        """
        self.report_files(self.annotate_file, morfs, directory)

    def annotate_file(self, fr, analysis):
        """Annotate a single file.

        `fr` is the FileReporter for the file to annotate.

        """
        statements = sorted(analysis.statements)
        missing = sorted(analysis.missing)
        excluded = sorted(analysis.excluded)

        if self.directory:
            dest_file = os.path.join(self.directory, flat_rootname(fr.relative_filename()))
            if dest_file.endswith("_py"):
                dest_file = dest_file[:-3] + ".py"
            dest_file += ",cover"
        else:
            dest_file = fr.filename + ",cover"

        with io.open(dest_file, 'w', encoding='utf8') as dest:
            i = 0
            j = 0
            covered = True
            source = fr.source()
            for lineno, line in enumerate(source.splitlines(True), start=1):
                while i < len(statements) and statements[i] < lineno:
                    i += 1
                while j < len(missing) and missing[j] < lineno:
                    j += 1
                if i < len(statements) and statements[i] == lineno:
                    covered = j >= len(missing) or missing[j] > lineno
                if self.blank_re.match(line):
                    dest.write(u'  ')
                elif self.else_re.match(line):
                    # Special logic for lines containing only 'else:'.
                    if i >= len(statements) and j >= len(missing):
                        dest.write(u'! ')
                    elif i >= len(statements) or j >= len(missing):
                        dest.write(u'> ')
                    elif statements[i] == missing[j]:
                        dest.write(u'! ')
                    else:
                        dest.write(u'> ')
                elif lineno in excluded:
                    dest.write(u'- ')
                elif covered:
                    dest.write(u'> ')
                else:
                    dest.write(u'! ')

                dest.write(line)
