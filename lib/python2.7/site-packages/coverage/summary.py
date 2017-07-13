# Licensed under the Apache License: http://www.apache.org/licenses/LICENSE-2.0
# For details: https://bitbucket.org/ned/coveragepy/src/default/NOTICE.txt

"""Summary reporting"""

import sys

from coverage import env
from coverage.report import Reporter
from coverage.results import Numbers
from coverage.misc import NotPython, CoverageException, output_encoding, StopEverything


class SummaryReporter(Reporter):
    """A reporter for writing the summary report."""

    def __init__(self, coverage, config):
        super(SummaryReporter, self).__init__(coverage, config)
        self.branches = coverage.data.has_arcs()

    def report(self, morfs, outfile=None):
        """Writes a report summarizing coverage statistics per module.

        `outfile` is a file object to write the summary to. It must be opened
        for native strings (bytes on Python 2, Unicode on Python 3).

        """
        if outfile is None:
            outfile = sys.stdout

        def writeout(line):
            """Write a line to the output, adding a newline."""
            if env.PY2:
                line = line.encode(output_encoding())
            outfile.write(line.rstrip())
            outfile.write("\n")

        fr_analysis = []
        skipped_count = 0
        total = Numbers()

        fmt_err = u"%s   %s: %s"

        for fr in self.find_file_reporters(morfs):
            try:
                analysis = self.coverage._analyze(fr)
                nums = analysis.numbers
                total += nums

                if self.config.skip_covered:
                    # Don't report on 100% files.
                    no_missing_lines = (nums.n_missing == 0)
                    no_missing_branches = (nums.n_partial_branches == 0)
                    if no_missing_lines and no_missing_branches:
                        skipped_count += 1
                        continue
                fr_analysis.append((fr, analysis))
            except StopEverything:
                # Don't report this on single files, it's a systemic problem.
                raise
            except Exception:
                report_it = not self.config.ignore_errors
                if report_it:
                    typ, msg = sys.exc_info()[:2]
                    # NotPython is only raised by PythonFileReporter, which has a
                    # should_be_python() method.
                    if issubclass(typ, NotPython) and not fr.should_be_python():
                        report_it = False
                if report_it:
                    writeout(fmt_err % (fr.relative_filename(), typ.__name__, msg))

        # Prepare the formatting strings, header, and column sorting.
        max_name = max([len(fr.relative_filename()) for (fr, analysis) in fr_analysis] + [5])
        fmt_name = u"%%- %ds  " % max_name
        fmt_skip_covered = u"\n%s file%s skipped due to complete coverage."

        header = (fmt_name % "Name") + u" Stmts   Miss"
        fmt_coverage = fmt_name + u"%6d %6d"
        if self.branches:
            header += u" Branch BrPart"
            fmt_coverage += u" %6d %6d"
        width100 = Numbers.pc_str_width()
        header += u"%*s" % (width100+4, "Cover")
        fmt_coverage += u"%%%ds%%%%" % (width100+3,)
        if self.config.show_missing:
            header += u"   Missing"
            fmt_coverage += u"   %s"
        rule = u"-" * len(header)

        column_order = dict(name=0, stmts=1, miss=2, cover=-1)
        if self.branches:
            column_order.update(dict(branch=3, brpart=4))

        # Write the header
        writeout(header)
        writeout(rule)

        # `lines` is a list of pairs, (line text, line values).  The line text
        # is a string that will be printed, and line values is a tuple of
        # sortable values.
        lines = []

        for (fr, analysis) in fr_analysis:
            try:
                nums = analysis.numbers

                args = (fr.relative_filename(), nums.n_statements, nums.n_missing)
                if self.branches:
                    args += (nums.n_branches, nums.n_partial_branches)
                args += (nums.pc_covered_str,)
                if self.config.show_missing:
                    missing_fmtd = analysis.missing_formatted()
                    if self.branches:
                        branches_fmtd = analysis.arcs_missing_formatted()
                        if branches_fmtd:
                            if missing_fmtd:
                                missing_fmtd += ", "
                            missing_fmtd += branches_fmtd
                    args += (missing_fmtd,)
                text = fmt_coverage % args
                # Add numeric percent coverage so that sorting makes sense.
                args += (nums.pc_covered,)
                lines.append((text, args))
            except Exception:
                report_it = not self.config.ignore_errors
                if report_it:
                    typ, msg = sys.exc_info()[:2]
                    # NotPython is only raised by PythonFileReporter, which has a
                    # should_be_python() method.
                    if typ is NotPython and not fr.should_be_python():
                        report_it = False
                if report_it:
                    writeout(fmt_err % (fr.relative_filename(), typ.__name__, msg))

        # Sort the lines and write them out.
        if getattr(self.config, 'sort', None):
            position = column_order.get(self.config.sort.lower())
            if position is None:
                raise CoverageException("Invalid sorting option: {0!r}".format(self.config.sort))
            lines.sort(key=lambda l: (l[1][position], l[0]))

        for line in lines:
            writeout(line[0])

        # Write a TOTAl line if we had more than one file.
        if total.n_files > 1:
            writeout(rule)
            args = ("TOTAL", total.n_statements, total.n_missing)
            if self.branches:
                args += (total.n_branches, total.n_partial_branches)
            args += (total.pc_covered_str,)
            if self.config.show_missing:
                args += ("",)
            writeout(fmt_coverage % args)

        # Write other final lines.
        if not total.n_files and not skipped_count:
            raise CoverageException("No data to report.")

        if self.config.skip_covered and skipped_count:
            writeout(fmt_skip_covered % (skipped_count, 's' if skipped_count > 1 else ''))

        return total.n_statements and total.pc_covered
