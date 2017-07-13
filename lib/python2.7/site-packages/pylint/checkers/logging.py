# Copyright (c) 2009-2011, 2013-2014 LOGILAB S.A. (Paris, FRANCE) <contact@logilab.fr>
# Copyright (c) 2014 Google, Inc.
# Copyright (c) 2015-2016 Claudiu Popa <pcmanticore@gmail.com>
# Copyright (c) 2016 Ashley Whetter <ashley@awhetter.co.uk>
# Licensed under the GPL: https://www.gnu.org/licenses/old-licenses/gpl-2.0.html
# For details: https://github.com/PyCQA/pylint/blob/master/COPYING

"""checker for use of Python logging
"""
import string

import six

import astroid

from pylint import checkers
from pylint import interfaces
from pylint.checkers import utils
from pylint.checkers.utils import check_messages



MSGS = {
    'W1201': ('Specify string format arguments as logging function parameters',
              'logging-not-lazy',
              'Used when a logging statement has a call form of '
              '"logging.<logging method>(format_string % (format_args...))". '
              'Such calls should leave string interpolation to the logging '
              'method itself and be written '
              '"logging.<logging method>(format_string, format_args...)" '
              'so that the program may avoid incurring the cost of the '
              'interpolation in those cases in which no message will be '
              'logged. For more, see '
              'http://www.python.org/dev/peps/pep-0282/.'),
    'W1202': ('Use % formatting in logging functions and pass the % '
              'parameters as arguments',
              'logging-format-interpolation',
              'Used when a logging statement has a call form of '
              '"logging.<logging method>(format_string.format(format_args...))"'
              '. Such calls should use % formatting instead, but leave '
              'interpolation to the logging function by passing the parameters '
              'as arguments.'),
    'E1200': ('Unsupported logging format character %r (%#02x) at index %d',
              'logging-unsupported-format',
              'Used when an unsupported format character is used in a logging\
              statement format string.'),
    'E1201': ('Logging format string ends in middle of conversion specifier',
              'logging-format-truncated',
              'Used when a logging statement format string terminates before\
              the end of a conversion specifier.'),
    'E1205': ('Too many arguments for logging format string',
              'logging-too-many-args',
              'Used when a logging format string is given too many arguments.'),
    'E1206': ('Not enough arguments for logging format string',
              'logging-too-few-args',
              'Used when a logging format string is given too few arguments.'),
    }


CHECKED_CONVENIENCE_FUNCTIONS = {
    'critical', 'debug', 'error', 'exception', 'fatal', 'info', 'warn', 'warning'
}


def is_method_call(func, types=(), methods=()):
    """Determines if a BoundMethod node represents a method call.

    Args:
      func (astroid.BoundMethod): The BoundMethod AST node to check.
      types (Optional[String]): Optional sequence of caller type names to restrict check.
      methods (Optional[String]): Optional sequence of method names to restrict check.

    Returns:
      bool: true if the node represents a method call for the given type and
      method names, False otherwise.
    """
    return (isinstance(func, astroid.BoundMethod)
            and isinstance(func.bound, astroid.Instance)
            and (func.bound.name in types if types else True)
            and (func.name in methods if methods else True))


class LoggingChecker(checkers.BaseChecker):
    """Checks use of the logging module."""

    __implements__ = interfaces.IAstroidChecker
    name = 'logging'
    msgs = MSGS

    options = (('logging-modules',
                {'default': ('logging',),
                 'type': 'csv',
                 'metavar': '<comma separated list>',
                 'help': 'Logging modules to check that the string format '
                         'arguments are in logging function parameter format'}
               ),
              )

    def visit_module(self, node): # pylint: disable=unused-argument
        """Clears any state left in this checker from last module checked."""
        # The code being checked can just as easily "import logging as foo",
        # so it is necessary to process the imports and store in this field
        # what name the logging module is actually given.
        self._logging_names = set()
        logging_mods = self.config.logging_modules

        self._logging_modules = set(logging_mods)
        self._from_imports = {}
        for logging_mod in logging_mods:
            parts = logging_mod.rsplit('.', 1)
            if len(parts) > 1:
                self._from_imports[parts[0]] = parts[1]

    def visit_importfrom(self, node):
        """Checks to see if a module uses a non-Python logging module."""
        try:
            logging_name = self._from_imports[node.modname]
            for module, as_name in node.names:
                if module == logging_name:
                    self._logging_names.add(as_name or module)
        except KeyError:
            pass

    def visit_import(self, node):
        """Checks to see if this module uses Python's built-in logging."""
        for module, as_name in node.names:
            if module in self._logging_modules:
                self._logging_names.add(as_name or module)

    @check_messages(*(MSGS.keys()))
    def visit_call(self, node):
        """Checks calls to logging methods."""
        def is_logging_name():
            return (isinstance(node.func, astroid.Attribute) and
                    isinstance(node.func.expr, astroid.Name) and
                    node.func.expr.name in self._logging_names)

        def is_logger_class():
            try:
                for inferred in node.func.infer():
                    if isinstance(inferred, astroid.BoundMethod):
                        parent = inferred._proxied.parent
                        if (isinstance(parent, astroid.ClassDef) and
                                (parent.qname() == 'logging.Logger' or
                                 any(ancestor.qname() == 'logging.Logger'
                                     for ancestor in parent.ancestors()))):
                            return True, inferred._proxied.name
            except astroid.exceptions.InferenceError:
                pass
            return False, None

        if is_logging_name():
            name = node.func.attrname
        else:
            result, name = is_logger_class()
            if not result:
                return
        self._check_log_method(node, name)

    def _check_log_method(self, node, name):
        """Checks calls to logging.log(level, format, *format_args)."""
        if name == 'log':
            if node.starargs or node.kwargs or len(node.args) < 2:
                # Either a malformed call, star args, or double-star args. Beyond
                # the scope of this checker.
                return
            format_pos = 1
        elif name in CHECKED_CONVENIENCE_FUNCTIONS:
            if node.starargs or node.kwargs or not node.args:
                # Either no args, star args, or double-star args. Beyond the
                # scope of this checker.
                return
            format_pos = 0
        else:
            return

        if isinstance(node.args[format_pos], astroid.BinOp) and node.args[format_pos].op == '%':
            self.add_message('logging-not-lazy', node=node)
        elif isinstance(node.args[format_pos], astroid.Call):
            self._check_call_func(node.args[format_pos])
        elif isinstance(node.args[format_pos], astroid.Const):
            self._check_format_string(node, format_pos)

    def _check_call_func(self, node):
        """Checks that function call is not format_string.format().

        Args:
          node (astroid.node_classes.CallFunc):
            CallFunc AST node to be checked.
        """
        func = utils.safe_infer(node.func)
        types = ('str', 'unicode')
        methods = ('format',)
        if is_method_call(func, types, methods) and not is_complex_format_str(func.bound):
            self.add_message('logging-format-interpolation', node=node)

    def _check_format_string(self, node, format_arg):
        """Checks that format string tokens match the supplied arguments.

        Args:
          node (astroid.node_classes.NodeNG): AST node to be checked.
          format_arg (int): Index of the format string in the node arguments.
        """
        num_args = _count_supplied_tokens(node.args[format_arg + 1:])
        if not num_args:
            # If no args were supplied, then all format strings are valid -
            # don't check any further.
            return
        format_string = node.args[format_arg].value
        if not isinstance(format_string, six.string_types):
            # If the log format is constant non-string (e.g. logging.debug(5)),
            # ensure there are no arguments.
            required_num_args = 0
        else:
            try:
                keyword_args, required_num_args = \
                    utils.parse_format_string(format_string)
                if keyword_args:
                    # Keyword checking on logging strings is complicated by
                    # special keywords - out of scope.
                    return
            except utils.UnsupportedFormatCharacter as ex:
                char = format_string[ex.index]
                self.add_message('logging-unsupported-format', node=node,
                                 args=(char, ord(char), ex.index))
                return
            except utils.IncompleteFormatString:
                self.add_message('logging-format-truncated', node=node)
                return
        if num_args > required_num_args:
            self.add_message('logging-too-many-args', node=node)
        elif num_args < required_num_args:
            self.add_message('logging-too-few-args', node=node)


def is_complex_format_str(node):
    """Checks if node represents a string with complex formatting specs.

    Args:
        node (astroid.node_classes.NodeNG): AST node to check
    Returns:
        bool: True if inferred string uses complex formatting, False otherwise
    """
    inferred = utils.safe_infer(node)
    if inferred is None or not isinstance(inferred.value, six.string_types):
        return True
    for _, _, format_spec, _ in string.Formatter().parse(inferred.value):
        if format_spec:
            return True
    return False


def _count_supplied_tokens(args):
    """Counts the number of tokens in an args list.

    The Python log functions allow for special keyword arguments: func,
    exc_info and extra. To handle these cases correctly, we only count
    arguments that aren't keywords.

    Args:
      args (list): AST nodes that are arguments for a log format string.

    Returns:
      int: Number of AST nodes that aren't keywords.
    """
    return sum(1 for arg in args if not isinstance(arg, astroid.Keyword))


def register(linter):
    """Required method to auto-register this checker."""
    linter.register_checker(LoggingChecker(linter))
