# Licensed under the Apache License: http://www.apache.org/licenses/LICENSE-2.0
# For details: https://bitbucket.org/ned/coveragepy/src/default/NOTICE.txt

"""File wrangling."""

import fnmatch
import ntpath
import os
import os.path
import posixpath
import re
import sys

from coverage import env
from coverage.backward import unicode_class
from coverage.misc import contract, CoverageException, join_regex, isolate_module


os = isolate_module(os)


def set_relative_directory():
    """Set the directory that `relative_filename` will be relative to."""
    global RELATIVE_DIR, CANONICAL_FILENAME_CACHE

    # The absolute path to our current directory.
    RELATIVE_DIR = os.path.normcase(abs_file(os.curdir) + os.sep)

    # Cache of results of calling the canonical_filename() method, to
    # avoid duplicating work.
    CANONICAL_FILENAME_CACHE = {}


def relative_directory():
    """Return the directory that `relative_filename` is relative to."""
    return RELATIVE_DIR


@contract(returns='unicode')
def relative_filename(filename):
    """Return the relative form of `filename`.

    The file name will be relative to the current directory when the
    `set_relative_directory` was called.

    """
    fnorm = os.path.normcase(filename)
    if fnorm.startswith(RELATIVE_DIR):
        filename = filename[len(RELATIVE_DIR):]
    return unicode_filename(filename)


@contract(returns='unicode')
def canonical_filename(filename):
    """Return a canonical file name for `filename`.

    An absolute path with no redundant components and normalized case.

    """
    if filename not in CANONICAL_FILENAME_CACHE:
        if not os.path.isabs(filename):
            for path in [os.curdir] + sys.path:
                if path is None:
                    continue
                f = os.path.join(path, filename)
                try:
                    exists = os.path.exists(f)
                except UnicodeError:
                    exists = False
                if exists:
                    filename = f
                    break
        cf = abs_file(filename)
        CANONICAL_FILENAME_CACHE[filename] = cf
    return CANONICAL_FILENAME_CACHE[filename]


def flat_rootname(filename):
    """A base for a flat file name to correspond to this file.

    Useful for writing files about the code where you want all the files in
    the same directory, but need to differentiate same-named files from
    different directories.

    For example, the file a/b/c.py will return 'a_b_c_py'

    """
    name = ntpath.splitdrive(filename)[1]
    return re.sub(r"[\\/.:]", "_", name)


if env.WINDOWS:

    _ACTUAL_PATH_CACHE = {}
    _ACTUAL_PATH_LIST_CACHE = {}

    def actual_path(path):
        """Get the actual path of `path`, including the correct case."""
        if env.PY2 and isinstance(path, unicode_class):
            path = path.encode(sys.getfilesystemencoding())
        if path in _ACTUAL_PATH_CACHE:
            return _ACTUAL_PATH_CACHE[path]

        head, tail = os.path.split(path)
        if not tail:
            # This means head is the drive spec: normalize it.
            actpath = head.upper()
        elif not head:
            actpath = tail
        else:
            head = actual_path(head)
            if head in _ACTUAL_PATH_LIST_CACHE:
                files = _ACTUAL_PATH_LIST_CACHE[head]
            else:
                try:
                    files = os.listdir(head)
                except OSError:
                    files = []
                _ACTUAL_PATH_LIST_CACHE[head] = files
            normtail = os.path.normcase(tail)
            for f in files:
                if os.path.normcase(f) == normtail:
                    tail = f
                    break
            actpath = os.path.join(head, tail)
        _ACTUAL_PATH_CACHE[path] = actpath
        return actpath

else:
    def actual_path(filename):
        """The actual path for non-Windows platforms."""
        return filename


if env.PY2:
    @contract(returns='unicode')
    def unicode_filename(filename):
        """Return a Unicode version of `filename`."""
        if isinstance(filename, str):
            encoding = sys.getfilesystemencoding() or sys.getdefaultencoding()
            filename = filename.decode(encoding, "replace")
        return filename
else:
    @contract(filename='unicode', returns='unicode')
    def unicode_filename(filename):
        """Return a Unicode version of `filename`."""
        return filename


@contract(returns='unicode')
def abs_file(filename):
    """Return the absolute normalized form of `filename`."""
    path = os.path.expandvars(os.path.expanduser(filename))
    try:
        path = os.path.realpath(path)
    except UnicodeError:
        pass
    path = os.path.abspath(path)
    path = actual_path(path)
    path = unicode_filename(path)
    return path


RELATIVE_DIR = None
CANONICAL_FILENAME_CACHE = None
set_relative_directory()


def isabs_anywhere(filename):
    """Is `filename` an absolute path on any OS?"""
    return ntpath.isabs(filename) or posixpath.isabs(filename)


def prep_patterns(patterns):
    """Prepare the file patterns for use in a `FnmatchMatcher`.

    If a pattern starts with a wildcard, it is used as a pattern
    as-is.  If it does not start with a wildcard, then it is made
    absolute with the current directory.

    If `patterns` is None, an empty list is returned.

    """
    prepped = []
    for p in patterns or []:
        if p.startswith(("*", "?")):
            prepped.append(p)
        else:
            prepped.append(abs_file(p))
    return prepped


class TreeMatcher(object):
    """A matcher for files in a tree.

    Construct with a list of paths, either files or directories. Paths match
    with the `match` method if they are one of the files, or if they are
    somewhere in a subtree rooted at one of the directories.

    """
    def __init__(self, paths):
        self.paths = list(paths)

    def __repr__(self):
        return "<TreeMatcher %r>" % self.paths

    def info(self):
        """A list of strings for displaying when dumping state."""
        return self.paths

    def match(self, fpath):
        """Does `fpath` indicate a file in one of our trees?"""
        for p in self.paths:
            if fpath.startswith(p):
                if fpath == p:
                    # This is the same file!
                    return True
                if fpath[len(p)] == os.sep:
                    # This is a file in the directory
                    return True
        return False


class ModuleMatcher(object):
    """A matcher for modules in a tree."""
    def __init__(self, module_names):
        self.modules = list(module_names)

    def __repr__(self):
        return "<ModuleMatcher %r>" % (self.modules)

    def info(self):
        """A list of strings for displaying when dumping state."""
        return self.modules

    def match(self, module_name):
        """Does `module_name` indicate a module in one of our packages?"""
        if not module_name:
            return False

        for m in self.modules:
            if module_name.startswith(m):
                if module_name == m:
                    return True
                if module_name[len(m)] == '.':
                    # This is a module in the package
                    return True

        return False


class FnmatchMatcher(object):
    """A matcher for files by file name pattern."""
    def __init__(self, pats):
        self.pats = pats[:]
        # fnmatch is platform-specific. On Windows, it does the Windows thing
        # of treating / and \ as equivalent. But on other platforms, we need to
        # take care of that ourselves.
        fnpats = (fnmatch.translate(p) for p in pats)
        fnpats = (p.replace(r"\/", r"[\\/]") for p in fnpats)
        if env.WINDOWS:
            # Windows is also case-insensitive.  BTW: the regex docs say that
            # flags like (?i) have to be at the beginning, but fnmatch puts
            # them at the end, and having two there seems to work fine.
            fnpats = (p + "(?i)" for p in fnpats)
        self.re = re.compile(join_regex(fnpats))

    def __repr__(self):
        return "<FnmatchMatcher %r>" % self.pats

    def info(self):
        """A list of strings for displaying when dumping state."""
        return self.pats

    def match(self, fpath):
        """Does `fpath` match one of our file name patterns?"""
        return self.re.match(fpath) is not None


def sep(s):
    """Find the path separator used in this string, or os.sep if none."""
    sep_match = re.search(r"[\\/]", s)
    if sep_match:
        the_sep = sep_match.group(0)
    else:
        the_sep = os.sep
    return the_sep


class PathAliases(object):
    """A collection of aliases for paths.

    When combining data files from remote machines, often the paths to source
    code are different, for example, due to OS differences, or because of
    serialized checkouts on continuous integration machines.

    A `PathAliases` object tracks a list of pattern/result pairs, and can
    map a path through those aliases to produce a unified path.

    """
    def __init__(self):
        self.aliases = []

    def add(self, pattern, result):
        """Add the `pattern`/`result` pair to the list of aliases.

        `pattern` is an `fnmatch`-style pattern.  `result` is a simple
        string.  When mapping paths, if a path starts with a match against
        `pattern`, then that match is replaced with `result`.  This models
        isomorphic source trees being rooted at different places on two
        different machines.

        `pattern` can't end with a wildcard component, since that would
        match an entire tree, and not just its root.

        """
        # The pattern can't end with a wildcard component.
        pattern = pattern.rstrip(r"\/")
        if pattern.endswith("*"):
            raise CoverageException("Pattern must not end with wildcards.")
        pattern_sep = sep(pattern)

        # The pattern is meant to match a filepath.  Let's make it absolute
        # unless it already is, or is meant to match any prefix.
        if not pattern.startswith('*') and not isabs_anywhere(pattern):
            pattern = abs_file(pattern)
        pattern += pattern_sep

        # Make a regex from the pattern.  fnmatch always adds a \Z to
        # match the whole string, which we don't want, so we remove the \Z.
        # While removing it, we only replace \Z if followed by paren, or at
        # end, to keep from destroying a literal \Z in the pattern.
        regex_pat = fnmatch.translate(pattern)
        regex_pat = re.sub(r'\\Z(\(|$)', r'\1', regex_pat)

        # We want */a/b.py to match on Windows too, so change slash to match
        # either separator.
        regex_pat = regex_pat.replace(r"\/", r"[\\/]")
        # We want case-insensitive matching, so add that flag.
        regex = re.compile(r"(?i)" + regex_pat)

        # Normalize the result: it must end with a path separator.
        result_sep = sep(result)
        result = result.rstrip(r"\/") + result_sep
        self.aliases.append((regex, result, pattern_sep, result_sep))

    def map(self, path):
        """Map `path` through the aliases.

        `path` is checked against all of the patterns.  The first pattern to
        match is used to replace the root of the path with the result root.
        Only one pattern is ever used.  If no patterns match, `path` is
        returned unchanged.

        The separator style in the result is made to match that of the result
        in the alias.

        Returns the mapped path.  If a mapping has happened, this is a
        canonical path.  If no mapping has happened, it is the original value
        of `path` unchanged.

        """
        for regex, result, pattern_sep, result_sep in self.aliases:
            m = regex.match(path)
            if m:
                new = path.replace(m.group(0), result)
                if pattern_sep != result_sep:
                    new = new.replace(pattern_sep, result_sep)
                new = canonical_filename(new)
                return new
        return path


def find_python_files(dirname):
    """Yield all of the importable Python files in `dirname`, recursively.

    To be importable, the files have to be in a directory with a __init__.py,
    except for `dirname` itself, which isn't required to have one.  The
    assumption is that `dirname` was specified directly, so the user knows
    best, but sub-directories are checked for a __init__.py to be sure we only
    find the importable files.

    """
    for i, (dirpath, dirnames, filenames) in enumerate(os.walk(dirname)):
        if i > 0 and '__init__.py' not in filenames:
            # If a directory doesn't have __init__.py, then it isn't
            # importable and neither are its files
            del dirnames[:]
            continue
        for filename in filenames:
            # We're only interested in files that look like reasonable Python
            # files: Must end with .py or .pyw, and must not have certain funny
            # characters that probably mean they are editor junk.
            if re.match(r"^[^.#~!$@%^&*()+=,]+\.pyw?$", filename):
                yield os.path.join(dirpath, filename)
