# -*- coding: utf-8 -*-
"""
    sphinx.ext.pngmath
    ~~~~~~~~~~~~~~~~~~

    Render math in HTML via dvipng. This extension has been deprecated; please
    use sphinx.ext.imgmath instead.

    :copyright: Copyright 2007-2017 by the Sphinx team, see AUTHORS.
    :license: BSD, see LICENSE for details.
"""

import re
import codecs
import shutil
import tempfile
import posixpath
from os import path
from subprocess import Popen, PIPE
from hashlib import sha1

from six import text_type

from docutils import nodes

import sphinx
from sphinx.errors import SphinxError, ExtensionError
from sphinx.util import logging
from sphinx.util.png import read_png_depth, write_png_depth
from sphinx.util.osutil import ensuredir, ENOENT, cd
from sphinx.util.pycompat import sys_encoding
from sphinx.ext.mathbase import setup_math as mathbase_setup, wrap_displaymath

if False:
    # For type annotation
    from typing import Any, Dict, Tuple  # NOQA
    from sphinx.application import Sphinx  # NOQA
    from sphinx.ext.mathbase import math as math_node, displaymath  # NOQA

logger = logging.getLogger(__name__)


class MathExtError(SphinxError):
    category = 'Math extension error'

    def __init__(self, msg, stderr=None, stdout=None):
        # type: (unicode, unicode, unicode) -> None
        if stderr:
            msg += '\n[stderr]\n' + stderr.decode(sys_encoding, 'replace')
        if stdout:
            msg += '\n[stdout]\n' + stdout.decode(sys_encoding, 'replace')
        SphinxError.__init__(self, msg)


DOC_HEAD = r'''
\documentclass[12pt]{article}
\usepackage[utf8x]{inputenc}
\usepackage{amsmath}
\usepackage{amsthm}
\usepackage{amssymb}
\usepackage{amsfonts}
\usepackage{bm}
\pagestyle{empty}
'''

DOC_BODY = r'''
\begin{document}
%s
\end{document}
'''

DOC_BODY_PREVIEW = r'''
\usepackage[active]{preview}
\begin{document}
\begin{preview}
%s
\end{preview}
\end{document}
'''

depth_re = re.compile(br'\[\d+ depth=(-?\d+)\]')


def render_math(self, math):
    # type: (nodes.NodeVisitor, unicode) -> Tuple[unicode, int]
    """Render the LaTeX math expression *math* using latex and dvipng.

    Return the filename relative to the built document and the "depth",
    that is, the distance of image bottom and baseline in pixels, if the
    option to use preview_latex is switched on.

    Error handling may seem strange, but follows a pattern: if LaTeX or
    dvipng aren't available, only a warning is generated (since that enables
    people on machines without these programs to at least build the rest
    of the docs successfully).  If the programs are there, however, they
    may not fail since that indicates a problem in the math source.
    """
    use_preview = self.builder.config.pngmath_use_preview
    latex = DOC_HEAD + self.builder.config.pngmath_latex_preamble
    latex += (use_preview and DOC_BODY_PREVIEW or DOC_BODY) % math

    shasum = "%s.png" % sha1(latex.encode('utf-8')).hexdigest()
    relfn = posixpath.join(self.builder.imgpath, 'math', shasum)
    outfn = path.join(self.builder.outdir, self.builder.imagedir, 'math', shasum)
    if path.isfile(outfn):
        depth = read_png_depth(outfn)
        return relfn, depth

    # if latex or dvipng has failed once, don't bother to try again
    if hasattr(self.builder, '_mathpng_warned_latex') or \
       hasattr(self.builder, '_mathpng_warned_dvipng'):
        return None, None

    # use only one tempdir per build -- the use of a directory is cleaner
    # than using temporary files, since we can clean up everything at once
    # just removing the whole directory (see cleanup_tempdir)
    if not hasattr(self.builder, '_mathpng_tempdir'):
        tempdir = self.builder._mathpng_tempdir = tempfile.mkdtemp()
    else:
        tempdir = self.builder._mathpng_tempdir

    with codecs.open(path.join(tempdir, 'math.tex'), 'w', 'utf-8') as tf:
        tf.write(latex)

    # build latex command; old versions of latex don't have the
    # --output-directory option, so we have to manually chdir to the
    # temp dir to run it.
    ltx_args = [self.builder.config.pngmath_latex, '--interaction=nonstopmode']
    # add custom args from the config file
    ltx_args.extend(self.builder.config.pngmath_latex_args)
    ltx_args.append('math.tex')

    with cd(tempdir):
        try:
            p = Popen(ltx_args, stdout=PIPE, stderr=PIPE)
        except OSError as err:
            if err.errno != ENOENT:   # No such file or directory
                raise
            logger.warning('LaTeX command %r cannot be run (needed for math '
                           'display), check the pngmath_latex setting',
                           self.builder.config.pngmath_latex)
            self.builder._mathpng_warned_latex = True
            return None, None

    stdout, stderr = p.communicate()
    if p.returncode != 0:
        raise MathExtError('latex exited with error', stderr, stdout)

    ensuredir(path.dirname(outfn))
    # use some standard dvipng arguments
    dvipng_args = [self.builder.config.pngmath_dvipng]
    dvipng_args += ['-o', outfn, '-T', 'tight', '-z9']
    # add custom ones from config value
    dvipng_args.extend(self.builder.config.pngmath_dvipng_args)
    if use_preview:
        dvipng_args.append('--depth')
    # last, the input file name
    dvipng_args.append(path.join(tempdir, 'math.dvi'))
    try:
        p = Popen(dvipng_args, stdout=PIPE, stderr=PIPE)
    except OSError as err:
        if err.errno != ENOENT:   # No such file or directory
            raise
        logger.warning('dvipng command %r cannot be run (needed for math '
                       'display), check the pngmath_dvipng setting',
                       self.builder.config.pngmath_dvipng)
        self.builder._mathpng_warned_dvipng = True
        return None, None
    stdout, stderr = p.communicate()
    if p.returncode != 0:
        raise MathExtError('dvipng exited with error', stderr, stdout)
    depth = None
    if use_preview:
        for line in stdout.splitlines():
            m = depth_re.match(line)
            if m:
                depth = int(m.group(1))
                write_png_depth(outfn, depth)
                break

    return relfn, depth


def cleanup_tempdir(app, exc):
    # type: (Sphinx, Exception) -> None
    if exc:
        return
    if not hasattr(app.builder, '_mathpng_tempdir'):
        return
    try:
        shutil.rmtree(app.builder._mathpng_tempdir)  # type: ignore
    except Exception:
        pass


def get_tooltip(self, node):
    # type: (nodes.NodeVisitor, math_node) -> unicode
    if self.builder.config.pngmath_add_tooltips:
        return ' alt="%s"' % self.encode(node['latex']).strip()
    return ''


def html_visit_math(self, node):
    # type: (nodes.NodeVisitor, math_node) -> None
    try:
        fname, depth = render_math(self, '$' + node['latex'] + '$')
    except MathExtError as exc:
        msg = text_type(exc)
        sm = nodes.system_message(msg, type='WARNING', level=2,
                                  backrefs=[], source=node['latex'])
        sm.walkabout(self)
        logger.warning('display latex %r: %s', node['latex'], msg)
        raise nodes.SkipNode
    if fname is None:
        # something failed -- use text-only as a bad substitute
        self.body.append('<span class="math">%s</span>' %
                         self.encode(node['latex']).strip())
    else:
        c = ('<img class="math" src="%s"' % fname) + get_tooltip(self, node)
        if depth is not None:
            c += ' style="vertical-align: %dpx"' % (-depth)
        self.body.append(c + '/>')
    raise nodes.SkipNode


def html_visit_displaymath(self, node):
    # type: (nodes.NodeVisitor, displaymath) -> None
    if node['nowrap']:
        latex = node['latex']
    else:
        latex = wrap_displaymath(node['latex'], None,
                                 self.builder.config.math_number_all)
    try:
        fname, depth = render_math(self, latex)
    except MathExtError as exc:
        msg = text_type(exc)
        sm = nodes.system_message(msg, type='WARNING', level=2,
                                  backrefs=[], source=node['latex'])
        sm.walkabout(self)
        logger.warning('inline latex %r: %s', node['latex'], msg)
        raise nodes.SkipNode
    self.body.append(self.starttag(node, 'div', CLASS='math'))
    self.body.append('<p>')
    if node['number']:
        self.body.append('<span class="eqno">(%s)</span>' % node['number'])
    if fname is None:
        # something failed -- use text-only as a bad substitute
        self.body.append('<span class="math">%s</span></p>\n</div>' %
                         self.encode(node['latex']).strip())
    else:
        self.body.append(('<img src="%s"' % fname) + get_tooltip(self, node) +
                         '/></p>\n</div>')
    raise nodes.SkipNode


def setup(app):
    # type: (Sphinx) -> Dict[unicode, Any]
    logger.warning('sphinx.ext.pngmath has been deprecated. '
                   'Please use sphinx.ext.imgmath instead.')
    try:
        mathbase_setup(app, (html_visit_math, None), (html_visit_displaymath, None))
    except ExtensionError:
        raise ExtensionError('sphinx.ext.pngmath: other math package is already loaded')

    app.add_config_value('pngmath_dvipng', 'dvipng', 'html')
    app.add_config_value('pngmath_latex', 'latex', 'html')
    app.add_config_value('pngmath_use_preview', False, 'html')
    app.add_config_value('pngmath_dvipng_args',
                         ['-gamma', '1.5', '-D', '110', '-bg', 'Transparent'],
                         'html')
    app.add_config_value('pngmath_latex_args', [], 'html')
    app.add_config_value('pngmath_latex_preamble', '', 'html')
    app.add_config_value('pngmath_add_tooltips', True, 'html')
    app.connect('build-finished', cleanup_tempdir)
    return {'version': sphinx.__display_version__, 'parallel_read_safe': True}
