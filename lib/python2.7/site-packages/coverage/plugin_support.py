# Licensed under the Apache License: http://www.apache.org/licenses/LICENSE-2.0
# For details: https://bitbucket.org/ned/coveragepy/src/default/NOTICE.txt

"""Support for plugins."""

import os
import os.path
import sys

from coverage.misc import CoverageException, isolate_module
from coverage.plugin import CoveragePlugin, FileTracer, FileReporter

os = isolate_module(os)


class Plugins(object):
    """The currently loaded collection of coverage.py plugins."""

    def __init__(self):
        self.order = []
        self.names = {}
        self.file_tracers = []

        self.current_module = None
        self.debug = None

    @classmethod
    def load_plugins(cls, modules, config, debug=None):
        """Load plugins from `modules`.

        Returns a list of loaded and configured plugins.

        """
        plugins = cls()
        plugins.debug = debug

        for module in modules:
            plugins.current_module = module
            __import__(module)
            mod = sys.modules[module]

            coverage_init = getattr(mod, "coverage_init", None)
            if not coverage_init:
                raise CoverageException(
                    "Plugin module %r didn't define a coverage_init function" % module
                )

            options = config.get_plugin_options(module)
            coverage_init(plugins, options)

        plugins.current_module = None
        return plugins

    def add_file_tracer(self, plugin):
        """Add a file tracer plugin.

        `plugin` is an instance of a third-party plugin class.  It must
        implement the :meth:`CoveragePlugin.file_tracer` method.

        """
        self._add_plugin(plugin, self.file_tracers)

    def add_noop(self, plugin):
        """Add a plugin that does nothing.

        This is only useful for testing the plugin support.

        """
        self._add_plugin(plugin, None)

    def _add_plugin(self, plugin, specialized):
        """Add a plugin object.

        `plugin` is a :class:`CoveragePlugin` instance to add.  `specialized`
        is a list to append the plugin to.

        """
        plugin_name = "%s.%s" % (self.current_module, plugin.__class__.__name__)
        if self.debug and self.debug.should('plugin'):
            self.debug.write("Loaded plugin %r: %r" % (self.current_module, plugin))
            labelled = LabelledDebug("plugin %r" % (self.current_module,), self.debug)
            plugin = DebugPluginWrapper(plugin, labelled)

        # pylint: disable=attribute-defined-outside-init
        plugin._coverage_plugin_name = plugin_name
        plugin._coverage_enabled = True
        self.order.append(plugin)
        self.names[plugin_name] = plugin
        if specialized is not None:
            specialized.append(plugin)

    def __nonzero__(self):
        return bool(self.order)

    __bool__ = __nonzero__

    def __iter__(self):
        return iter(self.order)

    def get(self, plugin_name):
        """Return a plugin by name."""
        return self.names[plugin_name]


class LabelledDebug(object):
    """A Debug writer, but with labels for prepending to the messages."""

    def __init__(self, label, debug, prev_labels=()):
        self.labels = list(prev_labels) + [label]
        self.debug = debug

    def add_label(self, label):
        """Add a label to the writer, and return a new `LabelledDebug`."""
        return LabelledDebug(label, self.debug, self.labels)

    def message_prefix(self):
        """The prefix to use on messages, combining the labels."""
        prefixes = self.labels + ['']
        return ":\n".join("  "*i+label for i, label in enumerate(prefixes))

    def write(self, message):
        """Write `message`, but with the labels prepended."""
        self.debug.write("%s%s" % (self.message_prefix(), message))


class DebugPluginWrapper(CoveragePlugin):
    """Wrap a plugin, and use debug to report on what it's doing."""

    def __init__(self, plugin, debug):
        super(DebugPluginWrapper, self).__init__()
        self.plugin = plugin
        self.debug = debug

    def file_tracer(self, filename):
        tracer = self.plugin.file_tracer(filename)
        self.debug.write("file_tracer(%r) --> %r" % (filename, tracer))
        if tracer:
            debug = self.debug.add_label("file %r" % (filename,))
            tracer = DebugFileTracerWrapper(tracer, debug)
        return tracer

    def file_reporter(self, filename):
        reporter = self.plugin.file_reporter(filename)
        self.debug.write("file_reporter(%r) --> %r" % (filename, reporter))
        if reporter:
            debug = self.debug.add_label("file %r" % (filename,))
            reporter = DebugFileReporterWrapper(filename, reporter, debug)
        return reporter

    def sys_info(self):
        return self.plugin.sys_info()


class DebugFileTracerWrapper(FileTracer):
    """A debugging `FileTracer`."""

    def __init__(self, tracer, debug):
        self.tracer = tracer
        self.debug = debug

    def _show_frame(self, frame):
        """A short string identifying a frame, for debug messages."""
        return "%s@%d" % (
            os.path.basename(frame.f_code.co_filename),
            frame.f_lineno,
        )

    def source_filename(self):
        sfilename = self.tracer.source_filename()
        self.debug.write("source_filename() --> %r" % (sfilename,))
        return sfilename

    def has_dynamic_source_filename(self):
        has = self.tracer.has_dynamic_source_filename()
        self.debug.write("has_dynamic_source_filename() --> %r" % (has,))
        return has

    def dynamic_source_filename(self, filename, frame):
        dyn = self.tracer.dynamic_source_filename(filename, frame)
        self.debug.write("dynamic_source_filename(%r, %s) --> %r" % (
            filename, self._show_frame(frame), dyn,
        ))
        return dyn

    def line_number_range(self, frame):
        pair = self.tracer.line_number_range(frame)
        self.debug.write("line_number_range(%s) --> %r" % (self._show_frame(frame), pair))
        return pair


class DebugFileReporterWrapper(FileReporter):
    """A debugging `FileReporter`."""

    def __init__(self, filename, reporter, debug):
        super(DebugFileReporterWrapper, self).__init__(filename)
        self.reporter = reporter
        self.debug = debug

    def relative_filename(self):
        ret = self.reporter.relative_filename()
        self.debug.write("relative_filename() --> %r" % (ret,))
        return ret

    def lines(self):
        ret = self.reporter.lines()
        self.debug.write("lines() --> %r" % (ret,))
        return ret

    def excluded_lines(self):
        ret = self.reporter.excluded_lines()
        self.debug.write("excluded_lines() --> %r" % (ret,))
        return ret

    def translate_lines(self, lines):
        ret = self.reporter.translate_lines(lines)
        self.debug.write("translate_lines(%r) --> %r" % (lines, ret))
        return ret

    def translate_arcs(self, arcs):
        ret = self.reporter.translate_arcs(arcs)
        self.debug.write("translate_arcs(%r) --> %r" % (arcs, ret))
        return ret

    def no_branch_lines(self):
        ret = self.reporter.no_branch_lines()
        self.debug.write("no_branch_lines() --> %r" % (ret,))
        return ret

    def exit_counts(self):
        ret = self.reporter.exit_counts()
        self.debug.write("exit_counts() --> %r" % (ret,))
        return ret

    def arcs(self):
        ret = self.reporter.arcs()
        self.debug.write("arcs() --> %r" % (ret,))
        return ret

    def source(self):
        ret = self.reporter.source()
        self.debug.write("source() --> %d chars" % (len(ret),))
        return ret

    def source_token_lines(self):
        ret = list(self.reporter.source_token_lines())
        self.debug.write("source_token_lines() --> %d tokens" % (len(ret),))
        return ret
