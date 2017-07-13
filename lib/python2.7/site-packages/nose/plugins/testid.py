"""
This plugin adds a test id (like #1) to each test name output. After
you've run once to generate test ids, you can re-run individual
tests by activating the plugin and passing the ids (with or
without the # prefix) instead of test names.

For example, if your normal test run looks like::

  % nosetests -v
  tests.test_a ... ok
  tests.test_b ... ok
  tests.test_c ... ok

When adding ``--with-id`` you'll see::

  % nosetests -v --with-id
  #1 tests.test_a ... ok
  #2 tests.test_b ... ok
  #3 tests.test_c ... ok

Then you can re-run individual tests by supplying just an id number::

  % nosetests -v --with-id 2
  #2 tests.test_b ... ok

You can also pass multiple id numbers::

  % nosetests -v --with-id 2 3
  #2 tests.test_b ... ok
  #3 tests.test_c ... ok
  
Since most shells consider '#' a special character, you can leave it out when
specifying a test id.

Note that when run without the -v switch, no special output is displayed, but
the ids file is still written.

Looping over failed tests
-------------------------

This plugin also adds a mode that will direct the test runner to record
failed tests. Subsequent test runs will then run only the tests that failed
last time. Activate this mode with the ``--failed`` switch::

 % nosetests -v --failed
 #1 test.test_a ... ok
 #2 test.test_b ... ERROR
 #3 test.test_c ... FAILED
 #4 test.test_d ... ok
 
On the second run, only tests #2 and #3 will run::

 % nosetests -v --failed
 #2 test.test_b ... ERROR
 #3 test.test_c ... FAILED

As you correct errors and tests pass, they'll drop out of subsequent runs.

First::

 % nosetests -v --failed
 #2 test.test_b ... ok
 #3 test.test_c ... FAILED

Second::

 % nosetests -v --failed
 #3 test.test_c ... FAILED

When all tests pass, the full set will run on the next invocation.

First::

 % nosetests -v --failed
 #3 test.test_c ... ok

Second::
 
 % nosetests -v --failed
 #1 test.test_a ... ok
 #2 test.test_b ... ok
 #3 test.test_c ... ok
 #4 test.test_d ... ok

.. note ::

  If you expect to use ``--failed`` regularly, it's a good idea to always run
  using the ``--with-id`` option. This will ensure that an id file is always
  created, allowing you to add ``--failed`` to the command line as soon as
  you have failing tests. Otherwise, your first run using ``--failed`` will
  (perhaps surprisingly) run *all* tests, because there won't be an id file
  containing the record of failed tests from your previous run.
  
"""
__test__ = False

import logging
import os
from nose.plugins import Plugin
from nose.util import src, set

try:
    from cPickle import dump, load
except ImportError:
    from pickle import dump, load

log = logging.getLogger(__name__)


class TestId(Plugin):
    """
    Activate to add a test id (like #1) to each test name output. Activate
    with --failed to rerun failing tests only.
    """
    name = 'id'
    idfile = None
    collecting = True
    loopOnFailed = False

    def options(self, parser, env):
        """Register commandline options.
        """
        Plugin.options(self, parser, env)
        parser.add_option('--id-file', action='store', dest='testIdFile',
                          default='.noseids', metavar="FILE",
                          help="Store test ids found in test runs in this "
                          "file. Default is the file .noseids in the "
                          "working directory.")
        parser.add_option('--failed', action='store_true',
                          dest='failed', default=False,
                          help="Run the tests that failed in the last "
                          "test run.")

    def configure(self, options, conf):
        """Configure plugin.
        """
        Plugin.configure(self, options, conf)
        if options.failed:
            self.enabled = True
            self.loopOnFailed = True
            log.debug("Looping on failed tests")
        self.idfile = os.path.expanduser(options.testIdFile)
        if not os.path.isabs(self.idfile):
            self.idfile = os.path.join(conf.workingDir, self.idfile)
        self.id = 1
        # Ids and tests are mirror images: ids are {id: test address} and
        # tests are {test address: id}
        self.ids = {}
        self.tests = {}
        self.failed = []
        self.source_names = []
        # used to track ids seen when tests is filled from
        # loaded ids file
        self._seen = {}
        self._write_hashes = conf.verbosity >= 2

    def finalize(self, result):
        """Save new ids file, if needed.
        """
        if result.wasSuccessful():
            self.failed = []
        if self.collecting:
            ids = dict(list(zip(list(self.tests.values()), list(self.tests.keys()))))
        else:
            ids = self.ids
        fh = open(self.idfile, 'wb')
        dump({'ids': ids,
              'failed': self.failed,
              'source_names': self.source_names}, fh)
        fh.close()
        log.debug('Saved test ids: %s, failed %s to %s',
                  ids, self.failed, self.idfile)

    def loadTestsFromNames(self, names, module=None):
        """Translate ids in the list of requested names into their
        test addresses, if they are found in my dict of tests.
        """
        log.debug('ltfn %s %s', names, module)
        try:
            fh = open(self.idfile, 'rb')
            data = load(fh)
            if 'ids' in data:
                self.ids = data['ids']
                self.failed = data['failed']
                self.source_names = data['source_names']
            else:
                # old ids field
                self.ids = data
                self.failed = []
                self.source_names = names
            if self.ids:
                self.id = max(self.ids) + 1
                self.tests = dict(list(zip(list(self.ids.values()), list(self.ids.keys()))))
            else:
                self.id = 1
            log.debug(
                'Loaded test ids %s tests %s failed %s sources %s from %s',
                self.ids, self.tests, self.failed, self.source_names,
                self.idfile)
            fh.close()
        except ValueError, e:
            # load() may throw a ValueError when reading the ids file, if it
            # was generated with a newer version of Python than we are currently
            # running.
            log.debug('Error loading %s : %s', self.idfile, str(e))
        except IOError:
            log.debug('IO error reading %s', self.idfile)

        if self.loopOnFailed and self.failed:
            self.collecting = False
            names = self.failed
            self.failed = []
        # I don't load any tests myself, only translate names like '#2'
        # into the associated test addresses
        translated = []
        new_source = []
        really_new = []
        for name in names:
            trans = self.tr(name)
            if trans != name:
                translated.append(trans)
            else:
                new_source.append(name)
        # names that are not ids and that are not in the current
        # list of source names go into the list for next time
        if new_source:
            new_set = set(new_source)
            old_set = set(self.source_names)
            log.debug("old: %s new: %s", old_set, new_set)
            really_new = [s for s in new_source
                          if not s in old_set]
            if really_new:
                # remember new sources
                self.source_names.extend(really_new)
            if not translated:
                # new set of source names, no translations
                # means "run the requested tests"
                names = new_source
        else:
            # no new names to translate and add to id set
            self.collecting = False
        log.debug("translated: %s new sources %s names %s",
                  translated, really_new, names)
        return (None, translated + really_new or names)

    def makeName(self, addr):
        log.debug("Make name %s", addr)
        filename, module, call = addr
        if filename is not None:
            head = src(filename)
        else:
            head = module
        if call is not None:
            return "%s:%s" % (head, call)
        return head

    def setOutputStream(self, stream):
        """Get handle on output stream so the plugin can print id #s
        """
        self.stream = stream

    def startTest(self, test):
        """Maybe output an id # before the test name.

        Example output::

          #1 test.test ... ok
          #2 test.test_two ... ok

        """
        adr = test.address()
        log.debug('start test %s (%s)', adr, adr in self.tests)
        if adr in self.tests:
            if adr in self._seen:
                self.write('   ')
            else:
                self.write('#%s ' % self.tests[adr])
                self._seen[adr] = 1
            return
        self.tests[adr] = self.id
        self.write('#%s ' % self.id)
        self.id += 1

    def afterTest(self, test):
        # None means test never ran, False means failed/err
        if test.passed is False:
            try:
                key = str(self.tests[test.address()])
            except KeyError:
                # never saw this test -- startTest didn't run
                pass
            else:
                if key not in self.failed:
                    self.failed.append(key)

    def tr(self, name):
        log.debug("tr '%s'", name)
        try:
            key = int(name.replace('#', ''))
        except ValueError:
            return name
        log.debug("Got key %s", key)
        # I'm running tests mapped from the ids file,
        # not collecting new ones
        if key in self.ids:
            return self.makeName(self.ids[key])
        return name

    def write(self, output):
        if self._write_hashes:
            self.stream.write(output)
