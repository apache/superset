"""
Adds a sphinx directive that can be used to automatically document a plugin.

this::

 .. autoplugin :: nose.plugins.foo
    :plugin: Pluggy
    
produces::

  .. automodule :: nose.plugins.foo
  
  Options
  -------

  .. cmdoption :: --foo=BAR, --fooble=BAR

    Do the foo thing to the new thing.

  Plugin
  ------

  .. autoclass :: nose.plugins.foo.Pluggy
     :members:

  Source
  ------

  .. include :: path/to/nose/plugins/foo.py
     :literal:

"""
import os
try:
    from docutils import nodes, utils
    from docutils.statemachine import ViewList
    from docutils.parsers.rst import directives
except ImportError:
    pass # won't run anyway

from nose.util import resolve_name
from nose.plugins.base import Plugin
from nose.plugins.manager import BuiltinPluginManager
from nose.config import Config
from nose.core import TestProgram
from inspect import isclass


def autoplugin_directive(dirname, arguments, options, content, lineno,
                         content_offset, block_text, state, state_machine):
    mod_name = arguments[0]
    mod = resolve_name(mod_name)
    plug_name = options.get('plugin', None)
    if plug_name:
        obj = getattr(mod, plug_name)
    else:
        for entry in dir(mod):
            obj = getattr(mod, entry)
            if isclass(obj) and issubclass(obj, Plugin) and obj is not Plugin:
                plug_name = '%s.%s' % (mod_name, entry)
                break
    
    # mod docstring
    rst = ViewList()
    rst.append('.. automodule :: %s\n' % mod_name, '<autodoc>')
    rst.append('', '<autodoc>')
    
    # options
    rst.append('Options', '<autodoc>')
    rst.append('-------', '<autodoc>')
    rst.append('', '<autodoc>')

    plug = obj()
    opts = OptBucket()
    plug.options(opts, {})
    for opt in opts:
        rst.append(opt.options(), '<autodoc>')
        rst.append('   \n', '<autodoc>')
        rst.append('   ' + opt.help + '\n', '<autodoc>')
        rst.append('\n', '<autodoc>')
        
    # plugin class
    rst.append('Plugin', '<autodoc>')
    rst.append('------', '<autodoc>')
    rst.append('', '<autodoc>')
    
    rst.append('.. autoclass :: %s\n' % plug_name, '<autodoc>')
    rst.append('   :members:\n', '<autodoc>')
    rst.append('   :show-inheritance:\n', '<autodoc>')
    rst.append('', '<autodoc>')
    
    # source
    rst.append('Source', '<autodoc>')
    rst.append('------', '<autodoc>')
    rst.append(
            '.. include :: %s\n' % utils.relative_path(
                state_machine.document['source'],
                os.path.abspath(mod.__file__.replace('.pyc', '.py'))),
            '<autodoc>')
    rst.append('   :literal:\n', '<autodoc>')
    rst.append('', '<autodoc>')
    
    node = nodes.section()
    node.document = state.document
    surrounding_title_styles = state.memo.title_styles
    surrounding_section_level = state.memo.section_level
    state.memo.title_styles = []
    state.memo.section_level = 0
    state.nested_parse(rst, 0, node, match_titles=1)
    state.memo.title_styles = surrounding_title_styles
    state.memo.section_level = surrounding_section_level

    return node.children


def autohelp_directive(dirname, arguments, options, content, lineno,
                       content_offset, block_text, state, state_machine):
    """produces rst from nose help"""
    config = Config(parserClass=OptBucket,
                    plugins=BuiltinPluginManager())
    parser = config.getParser(TestProgram.usage())
    rst = ViewList()
    for line in parser.format_help().split('\n'):
        rst.append(line, '<autodoc>')

    rst.append('Options', '<autodoc>')
    rst.append('-------', '<autodoc>')
    rst.append('', '<autodoc>')
    for opt in parser:
        rst.append(opt.options(), '<autodoc>')
        rst.append('   \n', '<autodoc>')
        rst.append('   ' + opt.help + '\n', '<autodoc>')
        rst.append('\n', '<autodoc>')    
    node = nodes.section()
    node.document = state.document
    surrounding_title_styles = state.memo.title_styles
    surrounding_section_level = state.memo.section_level
    state.memo.title_styles = []
    state.memo.section_level = 0
    state.nested_parse(rst, 0, node, match_titles=1)
    state.memo.title_styles = surrounding_title_styles
    state.memo.section_level = surrounding_section_level

    return node.children

    
class OptBucket(object):
    def __init__(self, doc=None, prog='nosetests'):
        self.opts = []
        self.doc = doc
        self.prog = prog

    def __iter__(self):
        return iter(self.opts)

    def format_help(self):
        return self.doc.replace('%prog', self.prog).replace(':\n', '::\n')
    
    def add_option(self, *arg, **kw):
        self.opts.append(Opt(*arg, **kw))


class Opt(object):
    def __init__(self, *arg, **kw):
        self.opts = arg
        self.action = kw.pop('action', None)
        self.default = kw.pop('default', None)
        self.metavar = kw.pop('metavar', None)
        self.help = kw.pop('help', None)

    def options(self):
        buf = []
        for optstring in self.opts:
            desc = optstring
            if self.action not in ('store_true', 'store_false'):
                desc += '=%s' % self.meta(optstring)
            buf.append(desc)
        return '.. cmdoption :: ' + ', '.join(buf)

    def meta(self, optstring):
        # FIXME optparser default metavar?
        return self.metavar or 'DEFAULT'

    
def setup(app):
    app.add_directive('autoplugin',
                      autoplugin_directive, 1, (1, 0, 1),
                      plugin=directives.unchanged)
    app.add_directive('autohelp', autohelp_directive, 0, (0, 0, 1))
