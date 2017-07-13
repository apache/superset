# -*- coding: utf-8 -*-
"""
    sphinx.ext.imgmath
    ~~~~~~~~~~~~~~~~~~

    Render math in HTML via dvipng or dvisvgm.

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
from sphinx.locale import _
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
\usepackage{anyfontsize}
\usepackage{bm}
\pagestyle{empty}
'''

DOC_BODY = r'''
\begin{document}
\fontsize{%d}{%d}\selectfont %s
\end{document}
'''

DOC_BODY_PREVIEW = r'''
\usepackage[active]{preview}
\begin{document}
\begin{preview}
\fontsize{%s}{%s}\selectfont %s
\end{preview}
\end{document}
'''

depth_re = re.compile(br'\[\d+ depth=(-?\d+)\]')


def render_math(self, math):
    # type: (nodes.NodeVisitor, unicode) -> Tuple[unicode, int]
    """Render the LaTeX math expression *math* using latex and dvipng or
    dvisvgm.

    Return the filename relative to the built document and the "depth",
    that is, the distance of image bottom and baseline in pixels, if the
    option to use preview_latex is switched on.

    Error handling may seem strange, but follows a pattern: if LaTeX or dvipng
    (dvisvgm) aren't available, only a warning is generated (since that enables
    people on machines without these programs to at least build the rest of the
    docs successfully).  If the programs are there, however, they may not fail
    since that indicates a problem in the math source.
    """
    image_format = self.builder.config.imgmath_image_format
    if image_format not in ('png', 'svg'):
        raise MathExtError(
            'imgmath_image_format must be either "png" or "svg"')

    font_size = self.builder.config.imgmath_font_size
    use_preview = self.builder.config.imgmath_use_preview
    latex = DOC_HEAD + self.builder.config.imgmath_latex_preamble
    latex += (use_preview and DOC_BODY_PREVIEW or DOC_BODY) % (
        font_size, int(round(font_size * 1.2)), math)

    shasum = "%s.%s" % (sha1(latex.encode('utf-8')).hexdigest(), image_format)
    relfn = posixpath.join(self.builder.imgpath, 'math', shasum)
    outfn = path.join(self.builder.outdir, self.builder.imagedir, 'math', shasum)
    if path.isfile(outfn):
        depth = read_png_depth(outfn)
        return relfn, depth

    # if latex or dvipng (dvisvgm) has failed once, don't bother to try again
    if hasattr(self.builder, '_imgmath_warned_latex') or \
       hasattr(self.builder, '_imgmath_warned_image_translator'):
        return None, None

    # use only one tempdir per build -- the use of a directory is cleaner
    # than using temporary files, since we can clean up everything at once
    # just removing the whole directory (see cleanup_tempdir)
    if not hasattr(self.builder, '_imgmath_tempdir'):
        tempdir = self.builder._imgmath_tempdir = tempfile.mkdtemp()
    else:
        tempdir = self.builder._imgmath_tempdir

    with codecs.open(path.join(tempdir, 'math.tex'), 'w', 'utf-8') as tf:
        tf.write(latex)

    # build latex command; old versions of latex don't have the
    # --output-directory option, so we have to manually chdir to the
    # temp dir to run it.
    ltx_args = [self.builder.config.imgmath_latex, '--interaction=nonstopmode']
    # add custom args from the config file
    ltx_args.extend(self.builder.config.imgmath_latex_args)
    ltx_args.append('math.tex')

    with cd(tempdir):
        try:
            p = Popen(ltx_args, stdout=PIPE, stderr=PIPE)
        except OSError as err:
            if err.errno != ENOENT:   # No such file or directory
                raise
            logger.warning('LaTeX command %r cannot be run (needed for math '
                           'display), check the imgmath_latex setting',
                           self.builder.config.imgmath_latex)
            self.builder._imgmath_warned_latex = True
            return None, None

    stdout, stderr = p.communicate()
    if p.returncode != 0:
        raise MathExtError('latex exited with error', stderr, stdout)

    ensuredir(path.dirname(outfn))
    if image_format == 'png':
        image_translator = 'dvipng'
        image_translator_executable = self.builder.config.imgmath_dvipng
        # use some standard dvipng arguments
        image_translator_args = [self.builder.config.imgmath_dvipng]
        image_translator_args += ['-o', outfn, '-T', 'tight', '-z9']
        # add custom ones from config value
        image_translator_args.extend(self.builder.config.imgmath_dvipng_args)
        if use_preview:
            image_translator_args.append('--depth')
    elif image_format == 'svg':
        image_translator = 'dvisvgm'
        image_translator_executable = self.builder.config.imgmath_dvisvgm
        # use some standard dvisvgm arguments
        image_translator_args = [self.builder.config.imgmath_dvisvgm]
        image_translator_args += ['-o', outfn]
        # add custom ones from config value
        image_translator_args.extend(self.builder.config.imgmath_dvisvgm_args)
    else:
        raise MathExtError(
            'imgmath_image_format must be either "png" or "svg"')

    # last, the input file name
    image_translator_args.append(path.join(tempdir, 'math.dvi'))

    try:
        p = Popen(image_translator_args, stdout=PIPE, stderr=PIPE)
    except OSError as err:
        if err.errno != ENOENT:   # No such file or directory
            raise
        logger.warning('%s command %r cannot be run (needed for math '
                       'display), check the imgmath_%s setting',
                       image_translator, image_translator_executable,
                       image_translator)
        self.builder._imgmath_warned_image_translator = True
        return None, None

    stdout, stderr = p.communicate()
    if p.returncode != 0:
        raise MathExtError('%s exited with error' %
                           image_translator, stderr, stdout)
    depth = None
    if use_preview and image_format == 'png':  # depth is only useful for png
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
    if not hasattr(app.builder, '_imgmath_tempdir'):
        return
    try:
        shutil.rmtree(app.builder._mathpng_tempdir)  # type: ignore
    except Exception:
        pass


def get_tooltip(self, node):
    # type: (nodes.NodeVisitor, math_node) -> unicode
    if self.builder.config.imgmath_add_tooltips:
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
        self.body.append('<span class="eqno">(%s)' % node['number'])
        self.add_permalink_ref(node, _('Permalink to this equation'))
        self.body.append('</span>')
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
    try:
        mathbase_setup(app, (html_visit_math, None), (html_visit_displaymath, None))
    except ExtensionError:
        raise ExtensionError('sphinx.ext.imgmath: other math package is already loaded')

    app.add_config_value('imgmath_image_format', 'png', 'html')
    app.add_config_value('imgmath_dvipng', 'dvipng', 'html')
    app.add_config_value('imgmath_dvisvgm', 'dvisvgm', 'html')
    app.add_config_value('imgmath_latex', 'latex', 'html')
    app.add_config_value('imgmath_use_preview', False, 'html')
    app.add_config_value('imgmath_dvipng_args',
                         ['-gamma', '1.5', '-D', '110', '-bg', 'Transparent'],
                         'html')
    app.add_config_value('imgmath_dvisvgm_args', ['--no-fonts'], 'html')
    app.add_config_value('imgmath_latex_args', [], 'html')
    app.add_config_value('imgmath_latex_preamble', '', 'html')
    app.add_config_value('imgmath_add_tooltips', True, 'html')
    app.add_config_value('imgmath_font_size', 12, 'html')
    app.connect('build-finished', cleanup_tempdir)
    return {'version': sphinx.__display_version__, 'parallel_read_safe': True}
