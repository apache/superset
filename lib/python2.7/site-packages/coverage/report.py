# Licensed under the Apache License: http://www.apache.org/licenses/LICENSE-2.0
# For details: https://bitbucket.org/ned/coveragepy/src/default/NOTICE.txt

"""Reporter foundation for coverage.py."""

import os
import warnings

from coverage.files import prep_patterns, FnmatchMatcher
from coverage.misc import CoverageException, NoSource, NotPython, isolate_module

os = isolate_module(os)


class Reporter(object):
    """A base class for all reporters."""

    def __init__(self, coverage, config):
        """Create a reporter.

        `coverage` is the coverage instance. `config` is an instance  of
        CoverageConfig, for controlling all sorts of behavior.

        """
        self.coverage = coverage
        self.config = config

        # The directory into which to place the report, used by some derived
        # classes.
        self.directory = None

        # Our method find_file_reporters used to set an attribute that other
        # code could read.  That's been refactored away, but some third parties
        # were using that attribute.  We'll continue to support it in a noisy
        # way for now.
        self._file_reporters = []

    @property
    def file_reporters(self):
        """Keep .file_reporters working for private-grabbing tools."""
        warnings.warn(
            "Report.file_reporters will no longer be available in Coverage.py 4.2",
            DeprecationWarning,
        )
        return self._file_reporters

    def find_file_reporters(self, morfs):
        """Find the FileReporters we'll report on.

        `morfs` is a list of modules or file names.

        Returns a list of FileReporters.

        """
        reporters = self.coverage._get_file_reporters(morfs)

        if self.config.include:
            matcher = FnmatchMatcher(prep_patterns(self.config.include))
            reporters = [fr for fr in reporters if matcher.match(fr.filename)]

        if self.config.omit:
            matcher = FnmatchMatcher(prep_patterns(self.config.omit))
            reporters = [fr for fr in reporters if not matcher.match(fr.filename)]

        self._file_reporters = sorted(reporters)
        return self._file_reporters

    def report_files(self, report_fn, morfs, directory=None):
        """Run a reporting function on a number of morfs.

        `report_fn` is called for each relative morf in `morfs`.  It is called
        as::

            report_fn(file_reporter, analysis)

        where `file_reporter` is the `FileReporter` for the morf, and
        `analysis` is the `Analysis` for the morf.

        """
        file_reporters = self.find_file_reporters(morfs)

        if not file_reporters:
            raise CoverageException("No data to report.")

        self.directory = directory
        if self.directory and not os.path.exists(self.directory):
            os.makedirs(self.directory)

        for fr in file_reporters:
            try:
                report_fn(fr, self.coverage._analyze(fr))
            except NoSource:
                if not self.config.ignore_errors:
                    raise
            except NotPython:
                # Only report errors for .py files, and only if we didn't
                # explicitly suppress those errors.
                # NotPython is only raised by PythonFileReporter, which has a
                # should_be_python() method.
                if fr.should_be_python():
                    if self.config.ignore_errors:
                        self.coverage._warn("Could not parse Python file {0}".format(fr.filename))
                    else:
                        raise
