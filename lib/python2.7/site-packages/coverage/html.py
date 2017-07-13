# Licensed under the Apache License: http://www.apache.org/licenses/LICENSE-2.0
# For details: https://bitbucket.org/ned/coveragepy/src/default/NOTICE.txt

"""HTML reporting for coverage.py."""

import datetime
import json
import os
import shutil

import coverage
from coverage import env
from coverage.backward import iitems
from coverage.files import flat_rootname
from coverage.misc import CoverageException, file_be_gone, Hasher, isolate_module
from coverage.report import Reporter
from coverage.results import Numbers
from coverage.templite import Templite

os = isolate_module(os)


# Static files are looked for in a list of places.
STATIC_PATH = [
    # The place Debian puts system Javascript libraries.
    "/usr/share/javascript",

    # Our htmlfiles directory.
    os.path.join(os.path.dirname(__file__), "htmlfiles"),
]


def data_filename(fname, pkgdir=""):
    """Return the path to a data file of ours.

    The file is searched for on `STATIC_PATH`, and the first place it's found,
    is returned.

    Each directory in `STATIC_PATH` is searched as-is, and also, if `pkgdir`
    is provided, at that sub-directory.

    """
    tried = []
    for static_dir in STATIC_PATH:
        static_filename = os.path.join(static_dir, fname)
        if os.path.exists(static_filename):
            return static_filename
        else:
            tried.append(static_filename)
        if pkgdir:
            static_filename = os.path.join(static_dir, pkgdir, fname)
            if os.path.exists(static_filename):
                return static_filename
            else:
                tried.append(static_filename)
    raise CoverageException(
        "Couldn't find static file %r from %r, tried: %r" % (fname, os.getcwd(), tried)
    )


def read_data(fname):
    """Return the contents of a data file of ours."""
    with open(data_filename(fname)) as data_file:
        return data_file.read()


def write_html(fname, html):
    """Write `html` to `fname`, properly encoded."""
    with open(fname, "wb") as fout:
        fout.write(html.encode('ascii', 'xmlcharrefreplace'))


class HtmlReporter(Reporter):
    """HTML reporting."""

    # These files will be copied from the htmlfiles directory to the output
    # directory.
    STATIC_FILES = [
        ("style.css", ""),
        ("jquery.min.js", "jquery"),
        ("jquery.ba-throttle-debounce.min.js", "jquery-throttle-debounce"),
        ("jquery.hotkeys.js", "jquery-hotkeys"),
        ("jquery.isonscreen.js", "jquery-isonscreen"),
        ("jquery.tablesorter.min.js", "jquery-tablesorter"),
        ("coverage_html.js", ""),
        ("keybd_closed.png", ""),
        ("keybd_open.png", ""),
    ]

    def __init__(self, cov, config):
        super(HtmlReporter, self).__init__(cov, config)
        self.directory = None
        title = self.config.html_title
        if env.PY2:
            title = title.decode("utf8")
        self.template_globals = {
            'escape': escape,
            'pair': pair,
            'title': title,
            '__url__': coverage.__url__,
            '__version__': coverage.__version__,
        }
        self.source_tmpl = Templite(read_data("pyfile.html"), self.template_globals)

        self.coverage = cov

        self.files = []
        self.all_files_nums = []
        self.has_arcs = self.coverage.data.has_arcs()
        self.status = HtmlStatus()
        self.extra_css = None
        self.totals = Numbers()
        self.time_stamp = datetime.datetime.now().strftime('%Y-%m-%d %H:%M')

    def report(self, morfs):
        """Generate an HTML report for `morfs`.

        `morfs` is a list of modules or file names.

        """
        assert self.config.html_dir, "must give a directory for html reporting"

        # Read the status data.
        self.status.read(self.config.html_dir)

        # Check that this run used the same settings as the last run.
        m = Hasher()
        m.update(self.config)
        these_settings = m.hexdigest()
        if self.status.settings_hash() != these_settings:
            self.status.reset()
            self.status.set_settings_hash(these_settings)

        # The user may have extra CSS they want copied.
        if self.config.extra_css:
            self.extra_css = os.path.basename(self.config.extra_css)

        # Process all the files.
        self.report_files(self.html_file, morfs, self.config.html_dir)

        if not self.all_files_nums:
            raise CoverageException("No data to report.")

        # Write the index file.
        self.index_file()

        self.make_local_static_report_files()
        return self.totals.n_statements and self.totals.pc_covered

    def make_local_static_report_files(self):
        """Make local instances of static files for HTML report."""
        # The files we provide must always be copied.
        for static, pkgdir in self.STATIC_FILES:
            shutil.copyfile(
                data_filename(static, pkgdir),
                os.path.join(self.directory, static)
            )

        # The user may have extra CSS they want copied.
        if self.extra_css:
            shutil.copyfile(
                self.config.extra_css,
                os.path.join(self.directory, self.extra_css)
            )

    def file_hash(self, source, fr):
        """Compute a hash that changes if the file needs to be re-reported."""
        m = Hasher()
        m.update(source)
        self.coverage.data.add_to_hash(fr.filename, m)
        return m.hexdigest()

    def html_file(self, fr, analysis):
        """Generate an HTML file for one source file."""
        rootname = flat_rootname(fr.relative_filename())
        html_filename = rootname + ".html"
        html_path = os.path.join(self.directory, html_filename)

        # Get the numbers for this file.
        nums = analysis.numbers
        self.all_files_nums.append(nums)

        if self.config.skip_covered:
            # Don't report on 100% files.
            no_missing_lines = (nums.n_missing == 0)
            no_missing_branches = (nums.n_partial_branches == 0)
            if no_missing_lines and no_missing_branches:
                # If there's an existing file, remove it.
                file_be_gone(html_path)
                return

        source = fr.source()

        # Find out if the file on disk is already correct.
        this_hash = self.file_hash(source.encode('utf-8'), fr)
        that_hash = self.status.file_hash(rootname)
        if this_hash == that_hash:
            # Nothing has changed to require the file to be reported again.
            self.files.append(self.status.index_info(rootname))
            return

        self.status.set_file_hash(rootname, this_hash)

        if self.has_arcs:
            missing_branch_arcs = analysis.missing_branch_arcs()
            arcs_executed = analysis.arcs_executed()

        # These classes determine which lines are highlighted by default.
        c_run = "run hide_run"
        c_exc = "exc"
        c_mis = "mis"
        c_par = "par " + c_run

        lines = []

        for lineno, line in enumerate(fr.source_token_lines(), start=1):
            # Figure out how to mark this line.
            line_class = []
            annotate_html = ""
            annotate_long = ""
            if lineno in analysis.statements:
                line_class.append("stm")
            if lineno in analysis.excluded:
                line_class.append(c_exc)
            elif lineno in analysis.missing:
                line_class.append(c_mis)
            elif self.has_arcs and lineno in missing_branch_arcs:
                line_class.append(c_par)
                shorts = []
                longs = []
                for b in missing_branch_arcs[lineno]:
                    if b < 0:
                        shorts.append("exit")
                    else:
                        shorts.append(b)
                    longs.append(fr.missing_arc_description(lineno, b, arcs_executed))
                # 202F is NARROW NO-BREAK SPACE.
                # 219B is RIGHTWARDS ARROW WITH STROKE.
                short_fmt = "%s&#x202F;&#x219B;&#x202F;%s"
                annotate_html = ",&nbsp;&nbsp; ".join(short_fmt % (lineno, d) for d in shorts)

                if len(longs) == 1:
                    annotate_long = longs[0]
                else:
                    annotate_long = "%d missed branches: %s" % (
                        len(longs),
                        ", ".join("%d) %s" % (num, ann_long)
                            for num, ann_long in enumerate(longs, start=1)),
                    )
            elif lineno in analysis.statements:
                line_class.append(c_run)

            # Build the HTML for the line.
            html = []
            for tok_type, tok_text in line:
                if tok_type == "ws":
                    html.append(escape(tok_text))
                else:
                    tok_html = escape(tok_text) or '&nbsp;'
                    html.append(
                        '<span class="%s">%s</span>' % (tok_type, tok_html)
                    )

            lines.append({
                'html': ''.join(html),
                'number': lineno,
                'class': ' '.join(line_class) or "pln",
                'annotate': annotate_html,
                'annotate_long': annotate_long,
            })

        # Write the HTML page for this file.
        html = self.source_tmpl.render({
            'c_exc': c_exc,
            'c_mis': c_mis,
            'c_par': c_par,
            'c_run': c_run,
            'has_arcs': self.has_arcs,
            'extra_css': self.extra_css,
            'fr': fr,
            'nums': nums,
            'lines': lines,
            'time_stamp': self.time_stamp,
        })

        write_html(html_path, html)

        # Save this file's information for the index file.
        index_info = {
            'nums': nums,
            'html_filename': html_filename,
            'relative_filename': fr.relative_filename(),
        }
        self.files.append(index_info)
        self.status.set_index_info(rootname, index_info)

    def index_file(self):
        """Write the index.html file for this report."""
        index_tmpl = Templite(read_data("index.html"), self.template_globals)

        self.totals = sum(self.all_files_nums)

        html = index_tmpl.render({
            'has_arcs': self.has_arcs,
            'extra_css': self.extra_css,
            'files': self.files,
            'totals': self.totals,
            'time_stamp': self.time_stamp,
        })

        write_html(os.path.join(self.directory, "index.html"), html)

        # Write the latest hashes for next time.
        self.status.write(self.directory)


class HtmlStatus(object):
    """The status information we keep to support incremental reporting."""

    STATUS_FILE = "status.json"
    STATUS_FORMAT = 1

    #           pylint: disable=wrong-spelling-in-comment,useless-suppression
    #  The data looks like:
    #
    #  {
    #      'format': 1,
    #      'settings': '540ee119c15d52a68a53fe6f0897346d',
    #      'version': '4.0a1',
    #      'files': {
    #          'cogapp___init__': {
    #              'hash': 'e45581a5b48f879f301c0f30bf77a50c',
    #              'index': {
    #                  'html_filename': 'cogapp___init__.html',
    #                  'name': 'cogapp/__init__',
    #                  'nums': <coverage.results.Numbers object at 0x10ab7ed0>,
    #              }
    #          },
    #          ...
    #          'cogapp_whiteutils': {
    #              'hash': '8504bb427fc488c4176809ded0277d51',
    #              'index': {
    #                  'html_filename': 'cogapp_whiteutils.html',
    #                  'name': 'cogapp/whiteutils',
    #                  'nums': <coverage.results.Numbers object at 0x10ab7d90>,
    #              }
    #          },
    #      },
    #  }

    def __init__(self):
        self.reset()

    def reset(self):
        """Initialize to empty."""
        self.settings = ''
        self.files = {}

    def read(self, directory):
        """Read the last status in `directory`."""
        usable = False
        try:
            status_file = os.path.join(directory, self.STATUS_FILE)
            with open(status_file, "r") as fstatus:
                status = json.load(fstatus)
        except (IOError, ValueError):
            usable = False
        else:
            usable = True
            if status['format'] != self.STATUS_FORMAT:
                usable = False
            elif status['version'] != coverage.__version__:
                usable = False

        if usable:
            self.files = {}
            for filename, fileinfo in iitems(status['files']):
                fileinfo['index']['nums'] = Numbers(*fileinfo['index']['nums'])
                self.files[filename] = fileinfo
            self.settings = status['settings']
        else:
            self.reset()

    def write(self, directory):
        """Write the current status to `directory`."""
        status_file = os.path.join(directory, self.STATUS_FILE)
        files = {}
        for filename, fileinfo in iitems(self.files):
            fileinfo['index']['nums'] = fileinfo['index']['nums'].init_args()
            files[filename] = fileinfo

        status = {
            'format': self.STATUS_FORMAT,
            'version': coverage.__version__,
            'settings': self.settings,
            'files': files,
        }
        with open(status_file, "w") as fout:
            json.dump(status, fout, separators=(',', ':'))

        # Older versions of ShiningPanda look for the old name, status.dat.
        # Accommodate them if we are running under Jenkins.
        # https://issues.jenkins-ci.org/browse/JENKINS-28428
        if "JENKINS_URL" in os.environ:
            with open(os.path.join(directory, "status.dat"), "w") as dat:
                dat.write("https://issues.jenkins-ci.org/browse/JENKINS-28428\n")

    def settings_hash(self):
        """Get the hash of the coverage.py settings."""
        return self.settings

    def set_settings_hash(self, settings):
        """Set the hash of the coverage.py settings."""
        self.settings = settings

    def file_hash(self, fname):
        """Get the hash of `fname`'s contents."""
        return self.files.get(fname, {}).get('hash', '')

    def set_file_hash(self, fname, val):
        """Set the hash of `fname`'s contents."""
        self.files.setdefault(fname, {})['hash'] = val

    def index_info(self, fname):
        """Get the information for index.html for `fname`."""
        return self.files.get(fname, {}).get('index', {})

    def set_index_info(self, fname, info):
        """Set the information for index.html for `fname`."""
        self.files.setdefault(fname, {})['index'] = info


# Helpers for templates and generating HTML

def escape(t):
    """HTML-escape the text in `t`.

    This is only suitable for HTML text, not attributes.

    """
    # Convert HTML special chars into HTML entities.
    return t.replace("&", "&amp;").replace("<", "&lt;")


def pair(ratio):
    """Format a pair of numbers so JavaScript can read them in an attribute."""
    return "%s %s" % ratio
