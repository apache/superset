# -*- coding: utf-8 -*-
"""
    sphinx.make_mode
    ~~~~~~~~~~~~~~~~

    sphinx-build -M command-line handling.

    This replaces the old, platform-dependent and once-generated content
    of Makefile / make.bat.

    This is in its own module so that importing it is fast.  It should not
    import the main Sphinx modules (like sphinx.applications, sphinx.builders).

    :copyright: Copyright 2007-2017 by the Sphinx team, see AUTHORS.
    :license: BSD, see LICENSE for details.
"""
from __future__ import print_function

import os
import sys
from os import path

import sphinx
from sphinx import cmdline
from sphinx.util.console import bold, blue  # type: ignore
from sphinx.util.osutil import cd, rmtree

if False:
    # For type annotation
    from typing import List  # NOQA

proj_name = os.getenv('SPHINXPROJ', '<project>')


BUILDERS = [
    ("",      "html",        "to make standalone HTML files"),
    ("",      "dirhtml",     "to make HTML files named index.html in directories"),
    ("",      "singlehtml",  "to make a single large HTML file"),
    ("",      "pickle",      "to make pickle files"),
    ("",      "json",        "to make JSON files"),
    ("",      "htmlhelp",    "to make HTML files and an HTML help project"),
    ("",      "qthelp",      "to make HTML files and a qthelp project"),
    ("",      "devhelp",     "to make HTML files and a Devhelp project"),
    ("",      "epub",        "to make an epub"),
    ("",      "latex",       "to make LaTeX files, you can set PAPER=a4 or PAPER=letter"),
    ("posix", "latexpdf",    "to make LaTeX and PDF files (default pdflatex)"),
    ("posix", "latexpdfja",  "to make LaTeX files and run them through platex/dvipdfmx"),
    ("",      "text",        "to make text files"),
    ("",      "man",         "to make manual pages"),
    ("",      "texinfo",     "to make Texinfo files"),
    ("posix", "info",        "to make Texinfo files and run them through makeinfo"),
    ("",      "gettext",     "to make PO message catalogs"),
    ("",      "changes",     "to make an overview of all changed/added/deprecated items"),
    ("",      "xml",         "to make Docutils-native XML files"),
    ("",      "pseudoxml",   "to make pseudoxml-XML files for display purposes"),
    ("",      "linkcheck",   "to check all external links for integrity"),
    ("",      "doctest",     "to run all doctests embedded in the documentation "
                             "(if enabled)"),
    ("",      "coverage",    "to run coverage check of the documentation (if enabled)"),
]


class Make(object):

    def __init__(self, srcdir, builddir, opts):
        # type: (unicode, unicode, List[unicode]) -> None
        self.srcdir = srcdir
        self.builddir = builddir
        self.opts = opts
        self.makecmd = os.environ.get('MAKE', 'make')  # refer $MAKE to determine make command

    def builddir_join(self, *comps):
        # type: (unicode) -> unicode
        return path.join(self.builddir, *comps)

    def build_clean(self):
        # type: () -> int
        if not path.exists(self.builddir):
            return 0
        elif not path.isdir(self.builddir):
            print("Error: %r is not a directory!" % self.builddir)
            return 1
        print("Removing everything under %r..." % self.builddir)
        for item in os.listdir(self.builddir):
            rmtree(self.builddir_join(item))
        return 0

    def build_help(self):
        # type: () -> None
        print(bold("Sphinx v%s" % sphinx.__display_version__))
        print("Please use `make %s' where %s is one of" % ((blue('target'),) * 2))  # type: ignore  # NOQA
        for osname, bname, description in BUILDERS:
            if not osname or os.name == osname:
                print('  %s  %s' % (blue(bname.ljust(10)), description))

    def build_html(self):
        # type: () -> int
        if self.run_generic_build('html') > 0:
            return 1
        print()
        print('Build finished. The HTML pages are in %s.' % self.builddir_join('html'))
        return 0

    def build_dirhtml(self):
        # type: () -> int
        if self.run_generic_build('dirhtml') > 0:
            return 1
        print()
        print('Build finished. The HTML pages are in %s.' %
              self.builddir_join('dirhtml'))
        return 0

    def build_singlehtml(self):
        # type: () -> int
        if self.run_generic_build('singlehtml') > 0:
            return 1
        print()
        print('Build finished. The HTML page is in %s.' %
              self.builddir_join('singlehtml'))
        return 0

    def build_pickle(self):
        # type: () -> int
        if self.run_generic_build('pickle') > 0:
            return 1
        print()
        print('Build finished; now you can process the pickle files.')
        return 0

    def build_json(self):
        # type: () -> int
        if self.run_generic_build('json') > 0:
            return 1
        print()
        print('Build finished; now you can process the JSON files.')
        return 0

    def build_htmlhelp(self):
        # type: () -> int
        if self.run_generic_build('htmlhelp') > 0:
            return 1
        print()
        print('Build finished; now you can run HTML Help Workshop with the '
              '.hhp project file in %s.' % self.builddir_join('htmlhelp'))
        return 0

    def build_qthelp(self):
        # type: () -> int
        if self.run_generic_build('qthelp') > 0:
            return 1
        print()
        print('Build finished; now you can run "qcollectiongenerator" with the '
              '.qhcp project file in %s, like this:' % self.builddir_join('qthelp'))
        print('$ qcollectiongenerator %s.qhcp' % self.builddir_join('qthelp', proj_name))
        print('To view the help file:')
        print('$ assistant -collectionFile %s.qhc' %
              self.builddir_join('qthelp', proj_name))
        return 0

    def build_devhelp(self):
        # type: () -> int
        if self.run_generic_build('devhelp') > 0:
            return 1
        print()
        print("Build finished.")
        print("To view the help file:")
        print("$ mkdir -p $HOME/.local/share/devhelp/" + proj_name)
        print("$ ln -s %s $HOME/.local/share/devhelp/%s" %
              (self.builddir_join('devhelp'), proj_name))
        print("$ devhelp")
        return 0

    def build_epub(self):
        # type: () -> int
        if self.run_generic_build('epub') > 0:
            return 1
        print()
        print('Build finished. The ePub file is in %s.' % self.builddir_join('epub'))
        return 0

    def build_latex(self):
        # type: () -> int
        if self.run_generic_build('latex') > 0:
            return 1
        print("Build finished; the LaTeX files are in %s." % self.builddir_join('latex'))
        if os.name == 'posix':
            print("Run `make' in that directory to run these through (pdf)latex")
            print("(use `make latexpdf' here to do that automatically).")
        return 0

    def build_latexpdf(self):
        # type: () -> int
        if self.run_generic_build('latex') > 0:
            return 1
        with cd(self.builddir_join('latex')):
            os.system('%s all-pdf' % self.makecmd)
        return 0

    def build_latexpdfja(self):
        # type: () -> int
        if self.run_generic_build('latex') > 0:
            return 1
        with cd(self.builddir_join('latex')):
            os.system('%s all-pdf-ja' % self.makecmd)
        return 0

    def build_text(self):
        # type: () -> int
        if self.run_generic_build('text') > 0:
            return 1
        print()
        print('Build finished. The text files are in %s.' % self.builddir_join('text'))
        return 0

    def build_texinfo(self):
        # type: () -> int
        if self.run_generic_build('texinfo') > 0:
            return 1
        print("Build finished; the Texinfo files are in %s." %
              self.builddir_join('texinfo'))
        if os.name == 'posix':
            print("Run `make' in that directory to run these through makeinfo")
            print("(use `make info' here to do that automatically).")
        return 0

    def build_info(self):
        # type: () -> int
        if self.run_generic_build('texinfo') > 0:
            return 1
        with cd(self.builddir_join('texinfo')):
            os.system('%s info' % self.makecmd)
        return 0

    def build_gettext(self):
        # type: () -> int
        dtdir = self.builddir_join('gettext', '.doctrees')
        if self.run_generic_build('gettext', doctreedir=dtdir) > 0:
            return 1
        print()
        print('Build finished. The message catalogs are in %s.' %
              self.builddir_join('gettext'))
        return 0

    def build_changes(self):
        # type: () -> int
        if self.run_generic_build('changes') > 0:
            return 1
        print()
        print('Build finished. The overview file is in %s.' %
              self.builddir_join('changes'))
        return 0

    def build_linkcheck(self):
        # type: () -> int
        res = self.run_generic_build('linkcheck')
        print()
        print('Link check complete; look for any errors in the above output '
              'or in %s.' % self.builddir_join('linkcheck', 'output.txt'))
        return res

    def build_doctest(self):
        # type: () -> int
        res = self.run_generic_build('doctest')
        print("Testing of doctests in the sources finished, look at the "
              "results in %s." % self.builddir_join('doctest', 'output.txt'))
        return res

    def build_coverage(self):
        # type: () -> int
        if self.run_generic_build('coverage') > 0:
            print("Has the coverage extension been enabled?")
            return 1
        print()
        print("Testing of coverage in the sources finished, look at the "
              "results in %s." % self.builddir_join('coverage'))
        return 0

    def build_xml(self):
        # type: () -> int
        if self.run_generic_build('xml') > 0:
            return 1
        print()
        print('Build finished. The XML files are in %s.' % self.builddir_join('xml'))
        return 0

    def build_pseudoxml(self):
        # type: () -> int
        if self.run_generic_build('pseudoxml') > 0:
            return 1
        print()
        print('Build finished. The pseudo-XML files are in %s.' %
              self.builddir_join('pseudoxml'))
        return 0

    def run_generic_build(self, builder, doctreedir=None):
        # type: (unicode, unicode) -> int
        # compatibility with old Makefile
        papersize = os.getenv('PAPER', '')
        opts = self.opts
        if papersize in ('a4', 'letter'):
            opts.extend(['-D', 'latex_elements.papersize=' + papersize])
        if doctreedir is None:
            doctreedir = self.builddir_join('doctrees')

        args = [sys.argv[0],
                '-b', builder,
                '-d', doctreedir,
                self.srcdir,
                self.builddir_join(builder)]
        return cmdline.main(args + opts)


def run_make_mode(args):
    # type: (List[unicode]) -> int
    if len(args) < 3:
        print('Error: at least 3 arguments (builder, source '
              'dir, build dir) are required.', file=sys.stderr)
        return 1
    make = Make(args[1], args[2], args[3:])
    run_method = 'build_' + args[0]
    if hasattr(make, run_method):
        return getattr(make, run_method)()
    return make.run_generic_build(args[0])
