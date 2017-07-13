"""Plugin built-in to Flake8 to treat pyflakes as a plugin."""
# -*- coding: utf-8 -*-
from __future__ import absolute_import

try:
    # The 'demandimport' breaks pyflakes and flake8.plugins.pyflakes
    from mercurial import demandimport
except ImportError:
    pass
else:
    demandimport.disable()
import os

import pyflakes
import pyflakes.checker

from flake8 import utils


FLAKE8_PYFLAKES_CODES = dict([line.split()[::-1] for line in (
    'F401 UnusedImport',
    'F402 ImportShadowedByLoopVar',
    'F403 ImportStarUsed',
    'F404 LateFutureImport',
    'F405 ImportStarUsage',
    'F406 ImportStarNotPermitted',
    'F407 FutureFeatureNotDefined',
    'F601 MultiValueRepeatedKeyLiteral',
    'F602 MultiValueRepeatedKeyVariable',
    'F621 TooManyExpressionsInStarredAssignment',
    'F622 TwoStarredExpressions',
    'F631 AssertTuple',
    'F701 BreakOutsideLoop',
    'F702 ContinueOutsideLoop',
    'F703 ContinueInFinally',
    'F704 YieldOutsideFunction',
    'F705 ReturnWithArgsInsideGenerator',
    'F706 ReturnOutsideFunction',
    'F707 DefaultExceptNotLast',
    'F721 DoctestSyntaxError',
    'F811 RedefinedWhileUnused',
    'F812 RedefinedInListComp',
    'F821 UndefinedName',
    'F822 UndefinedExport',
    'F823 UndefinedLocal',
    'F831 DuplicateArgument',
    'F841 UnusedVariable',
)])


def patch_pyflakes():
    """Add error codes to Pyflakes messages."""
    for name, obj in vars(pyflakes.messages).items():
        if name[0].isupper() and obj.message:
            obj.flake8_msg = '%s %s' % (
                FLAKE8_PYFLAKES_CODES.get(name, 'F999'), obj.message
            )


patch_pyflakes()


class FlakesChecker(pyflakes.checker.Checker):
    """Subclass the Pyflakes checker to conform with the flake8 API."""

    name = 'pyflakes'
    version = pyflakes.__version__
    with_doctest = False
    include_in_doctest = []
    exclude_from_doctest = []

    def __init__(self, tree, filename):
        """Initialize the PyFlakes plugin with an AST tree and filename."""
        filename = utils.normalize_paths(filename)[0]
        with_doctest = self.with_doctest
        included_by = [include for include in self.include_in_doctest
                       if include != '' and filename.startswith(include)]
        if included_by:
            with_doctest = True

        for exclude in self.exclude_from_doctest:
            if exclude != '' and filename.startswith(exclude):
                with_doctest = False
                overlaped_by = [include for include in included_by
                                if include.startswith(exclude)]

                if overlaped_by:
                    with_doctest = True

        super(FlakesChecker, self).__init__(tree, filename,
                                            withDoctest=with_doctest)

    @classmethod
    def add_options(cls, parser):
        """Register options for PyFlakes on the Flake8 OptionManager."""
        parser.add_option(
            '--builtins', parse_from_config=True, comma_separated_list=True,
            help="define more built-ins, comma separated",
        )
        parser.add_option(
            '--doctests', default=False, action='store_true',
            parse_from_config=True,
            help="check syntax of the doctests",
        )
        parser.add_option(
            '--include-in-doctest', default='',
            dest='include_in_doctest', parse_from_config=True,
            comma_separated_list=True, normalize_paths=True,
            help='Run doctests only on these files',
            type='string',
        )
        parser.add_option(
            '--exclude-from-doctest', default='',
            dest='exclude_from_doctest', parse_from_config=True,
            comma_separated_list=True, normalize_paths=True,
            help='Skip these files when running doctests',
            type='string',
        )

    @classmethod
    def parse_options(cls, options):
        """Parse option values from Flake8's OptionManager."""
        if options.builtins:
            cls.builtIns = cls.builtIns.union(options.builtins)
        cls.with_doctest = options.doctests

        included_files = []
        for included_file in options.include_in_doctest:
            if included_file == '':
                continue
            if not included_file.startswith((os.sep, './', '~/')):
                included_files.append('./' + included_file)
            else:
                included_files.append(included_file)
        cls.include_in_doctest = utils.normalize_paths(included_files)

        excluded_files = []
        for excluded_file in options.exclude_from_doctest:
            if excluded_file == '':
                continue
            if not excluded_file.startswith((os.sep, './', '~/')):
                excluded_files.append('./' + excluded_file)
            else:
                excluded_files.append(excluded_file)
        cls.exclude_from_doctest = utils.normalize_paths(excluded_files)

        inc_exc = set(cls.include_in_doctest).intersection(
            cls.exclude_from_doctest
        )
        if inc_exc:
            raise ValueError('"%s" was specified in both the '
                             'include-in-doctest and exclude-from-doctest '
                             'options. You are not allowed to specify it in '
                             'both for doctesting.' % inc_exc)

    def run(self):
        """Run the plugin."""
        for message in self.messages:
            col = getattr(message, 'col', 0)
            yield (message.lineno,
                   col,
                   (message.flake8_msg % message.message_args),
                   message.__class__)
