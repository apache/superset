# coding: utf-8
import logging
from os.path import basename
import sys

from coverage.misc import NoSource, NotPython
from coverage.phystokens import source_encoding
from coverage.report import Reporter


log = logging.getLogger('coveralls')


class CoverallReporter(Reporter):
    """ Custom coverage.py reporter for coveralls.io
    """
    def report(self, morfs=None):
        """ Generate a part of json report for coveralls

        `morfs` is a list of modules or filenames.
        `outfile` is a file object to write the json to.
        """
        self.source_files = []
        if hasattr(self, 'find_code_units'):
            self.find_code_units(morfs)
        else:
            self.find_file_reporters(morfs)

        units = self.code_units if hasattr(self, 'code_units') else self.file_reporters
        for cu in units:
            try:
                self.parse_file(cu, self.coverage._analyze(cu))
            except NoSource:
                if not self.config.ignore_errors:
                    log.warn('No source for %s', cu.filename)
            except NotPython:
                # Only report errors for .py files, and only if we didn't
                # explicitly suppress those errors.
                if cu.should_be_python() and not self.config.ignore_errors:
                    log.warn('Source file is not python %s', cu.filename)

        return self.source_files

    def get_hits(self, line_num, analysis):
        """ Source file stats for each line.

            * A positive integer if the line is covered,
            representing the number of times the line is hit during the test suite.
            * 0 if the line is not covered by the test suite.
            * null to indicate the line is not relevant to code coverage
              (it may be whitespace or a comment).
        """
        if line_num in analysis.missing:
            return 0
        if line_num in analysis.statements:
            return 1
        return None

    def parse_file(self, cu, analysis):
        """ Generate data for single file """
        if hasattr(analysis, 'parser'):
            filename = cu.file_locator.relative_filename(cu.filename)
            source_lines = analysis.parser.lines
            with cu.source_file() as source_file:
                source = source_file.read()
            try:
                if sys.version_info < (3, 0):
                    encoding = source_encoding(source)
                    if encoding != 'utf-8':
                        source = source.decode(encoding).encode('utf-8')
            except UnicodeDecodeError:
                log.warn('Source file %s can not be properly decoded, skipping. '
                         'Please check if encoding declaration is ok', basename(cu.filename))
                return
        else:
            if hasattr(cu, 'relative_filename'):
                filename = cu.relative_filename()
            else:
                filename = analysis.coverage.file_locator.relative_filename(cu.filename)
            source_lines = list(enumerate(analysis.file_reporter.source_token_lines()))
            source = analysis.file_reporter.source()
        coverage_lines = [self.get_hits(i, analysis) for i in range(1, len(source_lines) + 1)]
        self.source_files.append({
            'name': filename,
            'source': source,
            'coverage': coverage_lines
        })
