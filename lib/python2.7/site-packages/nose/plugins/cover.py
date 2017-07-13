"""If you have Ned Batchelder's coverage_ module installed, you may activate a
coverage report with the ``--with-coverage`` switch or NOSE_WITH_COVERAGE
environment variable. The coverage report will cover any python source module
imported after the start of the test run, excluding modules that match
testMatch. If you want to include those modules too, use the ``--cover-tests``
switch, or set the NOSE_COVER_TESTS environment variable to a true value. To
restrict the coverage report to modules from a particular package or packages,
use the ``--cover-package`` switch or the NOSE_COVER_PACKAGE environment
variable.

.. _coverage: http://www.nedbatchelder.com/code/modules/coverage.html
"""
import logging
import re
import sys
import StringIO
from nose.plugins.base import Plugin
from nose.util import src, tolist

log = logging.getLogger(__name__)


class Coverage(Plugin):
    """
    Activate a coverage report using Ned Batchelder's coverage module.
    """
    coverTests = False
    coverPackages = None
    coverInstance = None
    coverErase = False
    coverMinPercentage = None
    score = 200
    status = {}

    def options(self, parser, env):
        """
        Add options to command line.
        """
        super(Coverage, self).options(parser, env)
        parser.add_option("--cover-package", action="append",
                          default=env.get('NOSE_COVER_PACKAGE'),
                          metavar="PACKAGE",
                          dest="cover_packages",
                          help="Restrict coverage output to selected packages "
                          "[NOSE_COVER_PACKAGE]")
        parser.add_option("--cover-erase", action="store_true",
                          default=env.get('NOSE_COVER_ERASE'),
                          dest="cover_erase",
                          help="Erase previously collected coverage "
                          "statistics before run")
        parser.add_option("--cover-tests", action="store_true",
                          dest="cover_tests",
                          default=env.get('NOSE_COVER_TESTS'),
                          help="Include test modules in coverage report "
                          "[NOSE_COVER_TESTS]")
        parser.add_option("--cover-min-percentage", action="store",
                          dest="cover_min_percentage",
                          default=env.get('NOSE_COVER_MIN_PERCENTAGE'),
                          help="Minimum percentage of coverage for tests "
                          "to pass [NOSE_COVER_MIN_PERCENTAGE]")
        parser.add_option("--cover-inclusive", action="store_true",
                          dest="cover_inclusive",
                          default=env.get('NOSE_COVER_INCLUSIVE'),
                          help="Include all python files under working "
                          "directory in coverage report.  Useful for "
                          "discovering holes in test coverage if not all "
                          "files are imported by the test suite. "
                          "[NOSE_COVER_INCLUSIVE]")
        parser.add_option("--cover-html", action="store_true",
                          default=env.get('NOSE_COVER_HTML'),
                          dest='cover_html',
                          help="Produce HTML coverage information")
        parser.add_option('--cover-html-dir', action='store',
                          default=env.get('NOSE_COVER_HTML_DIR', 'cover'),
                          dest='cover_html_dir',
                          metavar='DIR',
                          help='Produce HTML coverage information in dir')
        parser.add_option("--cover-branches", action="store_true",
                          default=env.get('NOSE_COVER_BRANCHES'),
                          dest="cover_branches",
                          help="Include branch coverage in coverage report "
                          "[NOSE_COVER_BRANCHES]")
        parser.add_option("--cover-xml", action="store_true",
                          default=env.get('NOSE_COVER_XML'),
                          dest="cover_xml",
                          help="Produce XML coverage information")
        parser.add_option("--cover-xml-file", action="store",
                          default=env.get('NOSE_COVER_XML_FILE', 'coverage.xml'),
                          dest="cover_xml_file",
                          metavar="FILE",
                          help="Produce XML coverage information in file")

    def configure(self, options, conf):
        """
        Configure plugin.
        """
        try:
            self.status.pop('active')
        except KeyError:
            pass
        super(Coverage, self).configure(options, conf)
        if self.enabled:
            try:
                import coverage
                if not hasattr(coverage, 'coverage'):
                    raise ImportError("Unable to import coverage module")
            except ImportError:
                log.error("Coverage not available: "
                          "unable to import coverage module")
                self.enabled = False
                return
        self.conf = conf
        self.coverErase = options.cover_erase
        self.coverTests = options.cover_tests
        self.coverPackages = []
        if options.cover_packages:
            if isinstance(options.cover_packages, (list, tuple)):
                cover_packages = options.cover_packages
            else:
                cover_packages = [options.cover_packages]
            for pkgs in [tolist(x) for x in cover_packages]:
                self.coverPackages.extend(pkgs)
        self.coverInclusive = options.cover_inclusive
        if self.coverPackages:
            log.info("Coverage report will include only packages: %s",
                     self.coverPackages)
        self.coverHtmlDir = None
        if options.cover_html:
            self.coverHtmlDir = options.cover_html_dir
            log.debug('Will put HTML coverage report in %s', self.coverHtmlDir)
        self.coverBranches = options.cover_branches
        self.coverXmlFile = None
        if options.cover_min_percentage:
            self.coverMinPercentage = int(options.cover_min_percentage.rstrip('%'))
        if options.cover_xml:
            self.coverXmlFile = options.cover_xml_file
            log.debug('Will put XML coverage report in %s', self.coverXmlFile)
        if self.enabled:
            self.status['active'] = True
            self.coverInstance = coverage.coverage(auto_data=False,
                branch=self.coverBranches, data_suffix=conf.worker,
                source=self.coverPackages)
            self.coverInstance._warn_no_data = False
            self.coverInstance.is_worker = conf.worker
            self.coverInstance.exclude('#pragma[: ]+[nN][oO] [cC][oO][vV][eE][rR]')

            log.debug("Coverage begin")
            self.skipModules = sys.modules.keys()[:]
            if self.coverErase:
                log.debug("Clearing previously collected coverage statistics")
                self.coverInstance.combine()
                self.coverInstance.erase()

            if not self.coverInstance.is_worker:
                self.coverInstance.load()
                self.coverInstance.start()


    def beforeTest(self, *args, **kwargs):
        """
        Begin recording coverage information.
        """

        if self.coverInstance.is_worker:
            self.coverInstance.load()
            self.coverInstance.start()

    def afterTest(self, *args, **kwargs):
        """
        Stop recording coverage information.
        """

        if self.coverInstance.is_worker:
            self.coverInstance.stop()
            self.coverInstance.save()


    def report(self, stream):
        """
        Output code coverage report.
        """
        log.debug("Coverage report")
        self.coverInstance.stop()
        self.coverInstance.combine()
        self.coverInstance.save()
        modules = [module
                    for name, module in sys.modules.items()
                    if self.wantModuleCoverage(name, module)]
        log.debug("Coverage report will cover modules: %s", modules)
        self.coverInstance.report(modules, file=stream)

        import coverage
        if self.coverHtmlDir:
            log.debug("Generating HTML coverage report")
            try:
                self.coverInstance.html_report(modules, self.coverHtmlDir)
            except coverage.misc.CoverageException, e:
                log.warning("Failed to generate HTML report: %s" % str(e))

        if self.coverXmlFile:
            log.debug("Generating XML coverage report")
            try:
                self.coverInstance.xml_report(modules, self.coverXmlFile)
            except coverage.misc.CoverageException, e:
                log.warning("Failed to generate XML report: %s" % str(e))

        # make sure we have minimum required coverage
        if self.coverMinPercentage:
            f = StringIO.StringIO()
            self.coverInstance.report(modules, file=f)

            multiPackageRe = (r'-------\s\w+\s+\d+\s+\d+(?:\s+\d+\s+\d+)?'
                              r'\s+(\d+)%\s+\d*\s{0,1}$')
            singlePackageRe = (r'-------\s[\w./]+\s+\d+\s+\d+(?:\s+\d+\s+\d+)?'
                               r'\s+(\d+)%(?:\s+[-\d, ]+)\s{0,1}$')

            m = re.search(multiPackageRe, f.getvalue())
            if m is None:
                m = re.search(singlePackageRe, f.getvalue())

            if m:
                percentage = int(m.groups()[0])
                if percentage < self.coverMinPercentage:
                    log.error('TOTAL Coverage did not reach minimum '
                              'required: %d%%' % self.coverMinPercentage)
                    sys.exit(1)
            else:
                log.error("No total percentage was found in coverage output, "
                          "something went wrong.")


    def wantModuleCoverage(self, name, module):
        if not hasattr(module, '__file__'):
            log.debug("no coverage of %s: no __file__", name)
            return False
        module_file = src(module.__file__)
        if not module_file or not module_file.endswith('.py'):
            log.debug("no coverage of %s: not a python file", name)
            return False
        if self.coverPackages:
            for package in self.coverPackages:
                if (re.findall(r'^%s\b' % re.escape(package), name)
                    and (self.coverTests
                         or not self.conf.testMatch.search(name))):
                    log.debug("coverage for %s", name)
                    return True
        if name in self.skipModules:
            log.debug("no coverage for %s: loaded before coverage start",
                      name)
            return False
        if self.conf.testMatch.search(name) and not self.coverTests:
            log.debug("no coverage for %s: is a test", name)
            return False
        # accept any package that passed the previous tests, unless
        # coverPackages is on -- in that case, if we wanted this
        # module, we would have already returned True
        return not self.coverPackages

    def wantFile(self, file, package=None):
        """If inclusive coverage enabled, return true for all source files
        in wanted packages.
        """
        if self.coverInclusive:
            if file.endswith(".py"):
                if package and self.coverPackages:
                    for want in self.coverPackages:
                        if package.startswith(want):
                            return True
                else:
                    return True
        return None
