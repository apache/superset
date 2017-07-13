# Copyright (c) 2006, 2008-2014 LOGILAB S.A. (Paris, FRANCE) <contact@logilab.fr>
# Copyright (c) 2014-2016 Claudiu Popa <pcmanticore@gmail.com>

# Licensed under the GPL: https://www.gnu.org/licenses/old-licenses/gpl-2.0.html
# For details: https://github.com/PyCQA/pylint/blob/master/COPYING

# pylint: disable=W0622
"""a similarities / code duplication command line tool and pylint checker
"""

from __future__ import print_function
import sys
from collections import defaultdict

import six
from six.moves import zip

from pylint.interfaces import IRawChecker
from pylint.checkers import BaseChecker, table_lines_from_stats
from pylint.reporters.ureports.nodes import Table


class Similar(object):
    """finds copy-pasted lines of code in a project"""

    def __init__(self, min_lines=4, ignore_comments=False,
                 ignore_docstrings=False, ignore_imports=False):
        self.min_lines = min_lines
        self.ignore_comments = ignore_comments
        self.ignore_docstrings = ignore_docstrings
        self.ignore_imports = ignore_imports
        self.linesets = []

    def append_stream(self, streamid, stream, encoding=None):
        """append a file to search for similarities"""
        if encoding is None:
            readlines = stream.readlines
        else:
            readlines = lambda: [line.decode(encoding) for line in stream]
        try:
            self.linesets.append(LineSet(streamid,
                                         readlines(),
                                         self.ignore_comments,
                                         self.ignore_docstrings,
                                         self.ignore_imports))
        except UnicodeDecodeError:
            pass

    def run(self):
        """start looking for similarities and display results on stdout"""
        self._display_sims(self._compute_sims())

    def _compute_sims(self):
        """compute similarities in appended files"""
        no_duplicates = defaultdict(list)
        for num, lineset1, idx1, lineset2, idx2 in self._iter_sims():
            duplicate = no_duplicates[num]
            for couples in duplicate:
                if (lineset1, idx1) in couples or (lineset2, idx2) in couples:
                    couples.add((lineset1, idx1))
                    couples.add((lineset2, idx2))
                    break
            else:
                duplicate.append(set([(lineset1, idx1), (lineset2, idx2)]))
        sims = []
        for num, ensembles in six.iteritems(no_duplicates):
            for couples in ensembles:
                sims.append((num, couples))
        sims.sort()
        sims.reverse()
        return sims

    def _display_sims(self, sims):
        """display computed similarities on stdout"""
        nb_lignes_dupliquees = 0
        for num, couples in sims:
            print()
            print(num, "similar lines in", len(couples), "files")
            couples = sorted(couples)
            for lineset, idx in couples:
                print("==%s:%s" % (lineset.name, idx))
            # pylint: disable=W0631
            for line in lineset._real_lines[idx:idx+num]:
                print("  ", line.rstrip())
            nb_lignes_dupliquees += num * (len(couples)-1)
        nb_total_lignes = sum([len(lineset) for lineset in self.linesets])
        print("TOTAL lines=%s duplicates=%s percent=%.2f" \
            % (nb_total_lignes, nb_lignes_dupliquees,
               nb_lignes_dupliquees*100. / nb_total_lignes))

    def _find_common(self, lineset1, lineset2):
        """find similarities in the two given linesets"""
        lines1 = lineset1.enumerate_stripped
        lines2 = lineset2.enumerate_stripped
        find = lineset2.find
        index1 = 0
        min_lines = self.min_lines
        while index1 < len(lineset1):
            skip = 1
            num = 0
            for index2 in find(lineset1[index1]):
                non_blank = 0
                for num, ((_, line1), (_, line2)) in enumerate(
                        zip(lines1(index1), lines2(index2))):
                    if line1 != line2:
                        if non_blank > min_lines:
                            yield num, lineset1, index1, lineset2, index2
                        skip = max(skip, num)
                        break
                    if line1:
                        non_blank += 1
                else:
                    # we may have reach the end
                    num += 1
                    if non_blank > min_lines:
                        yield num, lineset1, index1, lineset2, index2
                    skip = max(skip, num)
            index1 += skip

    def _iter_sims(self):
        """iterate on similarities among all files, by making a cartesian
        product
        """
        for idx, lineset in enumerate(self.linesets[:-1]):
            for lineset2 in self.linesets[idx+1:]:
                for sim in self._find_common(lineset, lineset2):
                    yield sim

def stripped_lines(lines, ignore_comments, ignore_docstrings, ignore_imports):
    """return lines with leading/trailing whitespace and any ignored code
    features removed
    """

    strippedlines = []
    docstring = None
    for line in lines:
        line = line.strip()
        if ignore_docstrings:
            if not docstring and \
                   (line.startswith('"""') or line.startswith("'''")):
                docstring = line[:3]
                line = line[3:]
            if docstring:
                if line.endswith(docstring):
                    docstring = None
                line = ''
        if ignore_imports:
            if line.startswith("import ") or line.startswith("from "):
                line = ''
        if ignore_comments:
            # XXX should use regex in checkers/format to avoid cutting
            # at a "#" in a string
            line = line.split('#', 1)[0].strip()
        strippedlines.append(line)
    return strippedlines


class LineSet(object):
    """Holds and indexes all the lines of a single source file"""
    def __init__(self, name, lines, ignore_comments=False,
                 ignore_docstrings=False, ignore_imports=False):
        self.name = name
        self._real_lines = lines
        self._stripped_lines = stripped_lines(lines, ignore_comments,
                                              ignore_docstrings,
                                              ignore_imports)
        self._index = self._mk_index()

    def __str__(self):
        return '<Lineset for %s>' % self.name

    def __len__(self):
        return len(self._real_lines)

    def __getitem__(self, index):
        return self._stripped_lines[index]

    def __lt__(self, other):
        return self.name < other.name

    def __hash__(self):
        return id(self)

    def enumerate_stripped(self, start_at=0):
        """return an iterator on stripped lines, starting from a given index
        if specified, else 0
        """
        idx = start_at
        if start_at:
            lines = self._stripped_lines[start_at:]
        else:
            lines = self._stripped_lines
        for line in lines:
            #if line:
            yield idx, line
            idx += 1

    def find(self, stripped_line):
        """return positions of the given stripped line in this set"""
        return self._index.get(stripped_line, ())

    def _mk_index(self):
        """create the index for this set"""
        index = defaultdict(list)
        for line_no, line in enumerate(self._stripped_lines):
            if line:
                index[line].append(line_no)
        return index


MSGS = {'R0801': ('Similar lines in %s files\n%s',
                  'duplicate-code',
                  'Indicates that a set of similar lines has been detected \
                  among multiple file. This usually means that the code should \
                  be refactored to avoid this duplication.')}

def report_similarities(sect, stats, old_stats):
    """make a layout with some stats about duplication"""
    lines = ['', 'now', 'previous', 'difference']
    lines += table_lines_from_stats(stats, old_stats,
                                    ('nb_duplicated_lines',
                                     'percent_duplicated_lines'))
    sect.append(Table(children=lines, cols=4, rheaders=1, cheaders=1))


# wrapper to get a pylint checker from the similar class
class SimilarChecker(BaseChecker, Similar):
    """checks for similarities and duplicated code. This computation may be
    memory / CPU intensive, so you should disable it if you experiment some
    problems.
    """

    __implements__ = (IRawChecker,)
    # configuration section name
    name = 'similarities'
    # messages
    msgs = MSGS
    # configuration options
    # for available dict keys/values see the optik parser 'add_option' method
    options = (('min-similarity-lines',
                {'default' : 4, 'type' : "int", 'metavar' : '<int>',
                 'help' : 'Minimum lines number of a similarity.'}),
               ('ignore-comments',
                {'default' : True, 'type' : 'yn', 'metavar' : '<y or n>',
                 'help': 'Ignore comments when computing similarities.'}
               ),
               ('ignore-docstrings',
                {'default' : True, 'type' : 'yn', 'metavar' : '<y or n>',
                 'help': 'Ignore docstrings when computing similarities.'}
               ),
               ('ignore-imports',
                {'default' : False, 'type' : 'yn', 'metavar' : '<y or n>',
                 'help': 'Ignore imports when computing similarities.'}
               ),
              )
    # reports
    reports = (('RP0801', 'Duplication', report_similarities),)

    def __init__(self, linter=None):
        BaseChecker.__init__(self, linter)
        Similar.__init__(self, min_lines=4,
                         ignore_comments=True, ignore_docstrings=True)
        self.stats = None

    def set_option(self, optname, value, action=None, optdict=None):
        """method called to set an option (registered in the options list)

        overridden to report options setting to Similar
        """
        BaseChecker.set_option(self, optname, value, action, optdict)
        if optname == 'min-similarity-lines':
            self.min_lines = self.config.min_similarity_lines
        elif optname == 'ignore-comments':
            self.ignore_comments = self.config.ignore_comments
        elif optname == 'ignore-docstrings':
            self.ignore_docstrings = self.config.ignore_docstrings
        elif optname == 'ignore-imports':
            self.ignore_imports = self.config.ignore_imports

    def open(self):
        """init the checkers: reset linesets and statistics information"""
        self.linesets = []
        self.stats = self.linter.add_stats(nb_duplicated_lines=0,
                                           percent_duplicated_lines=0)

    def process_module(self, node):
        """process a module

        the module's content is accessible via the stream object

        stream must implement the readlines method
        """
        with node.stream() as stream:
            self.append_stream(self.linter.current_name,
                               stream,
                               node.file_encoding)

    def close(self):
        """compute and display similarities on closing (i.e. end of parsing)"""
        total = sum(len(lineset) for lineset in self.linesets)
        duplicated = 0
        stats = self.stats
        for num, couples in self._compute_sims():
            msg = []
            for lineset, idx in couples:
                msg.append("==%s:%s" % (lineset.name, idx))
            msg.sort()
            # pylint: disable=W0631
            for line in lineset._real_lines[idx:idx+num]:
                msg.append(line.rstrip())
            self.add_message('R0801', args=(len(couples), '\n'.join(msg)))
            duplicated += num * (len(couples) - 1)
        stats['nb_duplicated_lines'] = duplicated
        stats['percent_duplicated_lines'] = total and duplicated * 100. / total


def register(linter):
    """required method to auto register this checker """
    linter.register_checker(SimilarChecker(linter))

def usage(status=0):
    """display command line usage information"""
    print("finds copy pasted blocks in a set of files")
    print()
    print('Usage: symilar [-d|--duplicates min_duplicated_lines] \
[-i|--ignore-comments] [--ignore-docstrings] [--ignore-imports] file1...')
    sys.exit(status)

def Run(argv=None):
    """standalone command line access point"""
    if argv is None:
        argv = sys.argv[1:]
    from getopt import getopt
    s_opts = 'hdi'
    l_opts = ('help', 'duplicates=', 'ignore-comments', 'ignore-imports',
              'ignore-docstrings')
    min_lines = 4
    ignore_comments = False
    ignore_docstrings = False
    ignore_imports = False
    opts, args = getopt(argv, s_opts, l_opts)
    for opt, val in opts:
        if opt in ('-d', '--duplicates'):
            min_lines = int(val)
        elif opt in ('-h', '--help'):
            usage()
        elif opt in ('-i', '--ignore-comments'):
            ignore_comments = True
        elif opt in ('--ignore-docstrings',):
            ignore_docstrings = True
        elif opt in ('--ignore-imports',):
            ignore_imports = True
    if not args:
        usage(1)
    sim = Similar(min_lines, ignore_comments, ignore_docstrings, ignore_imports)
    for filename in args:
        with open(filename) as stream:
            sim.append_stream(filename, stream)
    sim.run()
    sys.exit(0)

if __name__ == '__main__':
    Run()
