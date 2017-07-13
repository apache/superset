"""This plugin will run tests using the hotshot profiler, which is part
of the standard library. To turn it on, use the ``--with-profile`` option
or set the NOSE_WITH_PROFILE environment variable. Profiler output can be
controlled with the ``--profile-sort`` and ``--profile-restrict`` options,
and the profiler output file may be changed with ``--profile-stats-file``.

See the `hotshot documentation`_ in the standard library documentation for
more details on the various output options.

.. _hotshot documentation: http://docs.python.org/library/hotshot.html
"""

try:
    import hotshot
    from hotshot import stats
except ImportError:
    hotshot, stats = None, None
import logging
import os
import sys
import tempfile
from nose.plugins.base import Plugin
from nose.util import tolist

log = logging.getLogger('nose.plugins')

class Profile(Plugin):
    """
    Use this plugin to run tests using the hotshot profiler. 
    """
    pfile = None
    clean_stats_file = False
    def options(self, parser, env):
        """Register commandline options.
        """
        if not self.available():
            return
        Plugin.options(self, parser, env)
        parser.add_option('--profile-sort', action='store', dest='profile_sort',
                          default=env.get('NOSE_PROFILE_SORT', 'cumulative'),
                          metavar="SORT",
                          help="Set sort order for profiler output")
        parser.add_option('--profile-stats-file', action='store',
                          dest='profile_stats_file',
                          metavar="FILE",
                          default=env.get('NOSE_PROFILE_STATS_FILE'),
                          help='Profiler stats file; default is a new '
                          'temp file on each run')
        parser.add_option('--profile-restrict', action='append',
                          dest='profile_restrict',
                          metavar="RESTRICT",
                          default=env.get('NOSE_PROFILE_RESTRICT'),
                          help="Restrict profiler output. See help for "
                          "pstats.Stats for details")

    def available(cls):
        return hotshot is not None
    available = classmethod(available)

    def begin(self):
        """Create profile stats file and load profiler.
        """
        if not self.available():
            return
        self._create_pfile()
        self.prof = hotshot.Profile(self.pfile)

    def configure(self, options, conf):
        """Configure plugin.
        """
        if not self.available():
            self.enabled = False
            return
        Plugin.configure(self, options, conf)
        self.conf = conf
        if options.profile_stats_file:
            self.pfile = options.profile_stats_file
            self.clean_stats_file = False
        else:
            self.pfile = None
            self.clean_stats_file = True
        self.fileno = None
        self.sort = options.profile_sort
        self.restrict = tolist(options.profile_restrict)

    def prepareTest(self, test):
        """Wrap entire test run in :func:`prof.runcall`.
        """
        if not self.available():
            return
        log.debug('preparing test %s' % test)
        def run_and_profile(result, prof=self.prof, test=test):
            self._create_pfile()
            prof.runcall(test, result)
        return run_and_profile

    def report(self, stream):
        """Output profiler report.
        """
        log.debug('printing profiler report')
        self.prof.close()
        prof_stats = stats.load(self.pfile)
        prof_stats.sort_stats(self.sort)

        # 2.5 has completely different stream handling from 2.4 and earlier.
        # Before 2.5, stats objects have no stream attribute; in 2.5 and later
        # a reference sys.stdout is stored before we can tweak it.
        compat_25 = hasattr(prof_stats, 'stream')
        if compat_25:
            tmp = prof_stats.stream
            prof_stats.stream = stream
        else:
            tmp = sys.stdout
            sys.stdout = stream
        try:
            if self.restrict:
                log.debug('setting profiler restriction to %s', self.restrict)
                prof_stats.print_stats(*self.restrict)
            else:
                prof_stats.print_stats()
        finally:
            if compat_25:
                prof_stats.stream = tmp
            else:
                sys.stdout = tmp

    def finalize(self, result):
        """Clean up stats file, if configured to do so.
        """
        if not self.available():
            return
        try:
            self.prof.close()
        except AttributeError:
            # TODO: is this trying to catch just the case where not
            # hasattr(self.prof, "close")?  If so, the function call should be
            # moved out of the try: suite.
            pass
        if self.clean_stats_file:
            if self.fileno:
                try:
                    os.close(self.fileno)
                except OSError:
                    pass
            try:
                os.unlink(self.pfile)
            except OSError:
                pass
        return None

    def _create_pfile(self):
        if not self.pfile:
            self.fileno, self.pfile = tempfile.mkstemp()
            self.clean_stats_file = True
