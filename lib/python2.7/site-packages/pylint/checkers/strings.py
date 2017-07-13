# Copyright (c) 2009-2014 LOGILAB S.A. (Paris, FRANCE) <contact@logilab.fr>
# Copyright (c) 2013-2014 Google, Inc.
# Copyright (c) 2013-2016 Claudiu Popa <pcmanticore@gmail.com>


# Licensed under the GPL: https://www.gnu.org/licenses/old-licenses/gpl-2.0.html
# For details: https://github.com/PyCQA/pylint/blob/master/COPYING

"""Checker for string formatting operations.
"""

import sys
import tokenize
import string
import numbers

import six

import astroid
from pylint.interfaces import ITokenChecker, IAstroidChecker, IRawChecker
from pylint.checkers import BaseChecker, BaseTokenChecker
from pylint.checkers import utils
from pylint.checkers.utils import check_messages


_PY3K = sys.version_info[:2] >= (3, 0)
_PY27 = sys.version_info[:2] == (2, 7)

MSGS = {
    'E1300': ("Unsupported format character %r (%#02x) at index %d",
              "bad-format-character",
              "Used when a unsupported format character is used in a format\
              string."),
    'E1301': ("Format string ends in middle of conversion specifier",
              "truncated-format-string",
              "Used when a format string terminates before the end of a \
              conversion specifier."),
    'E1302': ("Mixing named and unnamed conversion specifiers in format string",
              "mixed-format-string",
              "Used when a format string contains both named (e.g. '%(foo)d') \
              and unnamed (e.g. '%d') conversion specifiers.  This is also \
              used when a named conversion specifier contains * for the \
              minimum field width and/or precision."),
    'E1303': ("Expected mapping for format string, not %s",
              "format-needs-mapping",
              "Used when a format string that uses named conversion specifiers \
              is used with an argument that is not a mapping."),
    'W1300': ("Format string dictionary key should be a string, not %s",
              "bad-format-string-key",
              "Used when a format string that uses named conversion specifiers \
              is used with a dictionary whose keys are not all strings."),
    'W1301': ("Unused key %r in format string dictionary",
              "unused-format-string-key",
              "Used when a format string that uses named conversion specifiers \
              is used with a dictionary that contains keys not required by the \
              format string."),
    'E1304': ("Missing key %r in format string dictionary",
              "missing-format-string-key",
              "Used when a format string that uses named conversion specifiers \
              is used with a dictionary that doesn't contain all the keys \
              required by the format string."),
    'E1305': ("Too many arguments for format string",
              "too-many-format-args",
              "Used when a format string that uses unnamed conversion \
              specifiers is given too many arguments."),
    'E1306': ("Not enough arguments for format string",
              "too-few-format-args",
              "Used when a format string that uses unnamed conversion \
              specifiers is given too few arguments"),
    'E1310': ("Suspicious argument in %s.%s call",
              "bad-str-strip-call",
              "The argument to a str.{l,r,}strip call contains a"
              " duplicate character, "),
    'W1302': ("Invalid format string",
              "bad-format-string",
              "Used when a PEP 3101 format string is invalid.",
              {'minversion': (2, 7)}),
    'W1303': ("Missing keyword argument %r for format string",
              "missing-format-argument-key",
              "Used when a PEP 3101 format string that uses named fields "
              "doesn't receive one or more required keywords.",
              {'minversion': (2, 7)}),
    'W1304': ("Unused format argument %r",
              "unused-format-string-argument",
              "Used when a PEP 3101 format string that uses named "
              "fields is used with an argument that "
              "is not required by the format string.",
              {'minversion': (2, 7)}),
    'W1305': ("Format string contains both automatic field numbering "
              "and manual field specification",
              "format-combined-specification",
              "Used when a PEP 3101 format string contains both automatic "
              "field numbering (e.g. '{}') and manual field "
              "specification (e.g. '{0}').",
              {'minversion': (2, 7)}),
    'W1306': ("Missing format attribute %r in format specifier %r",
              "missing-format-attribute",
              "Used when a PEP 3101 format string uses an "
              "attribute specifier ({0.length}), but the argument "
              "passed for formatting doesn't have that attribute.",
              {'minversion': (2, 7)}),
    'W1307': ("Using invalid lookup key %r in format specifier %r",
              "invalid-format-index",
              "Used when a PEP 3101 format string uses a lookup specifier "
              "({a[1]}), but the argument passed for formatting "
              "doesn't contain or doesn't have that key as an attribute.",
              {'minversion': (2, 7)})
    }

OTHER_NODES = (astroid.Const, astroid.List, astroid.Repr,
               astroid.Lambda, astroid.FunctionDef,
               astroid.ListComp, astroid.SetComp, astroid.GeneratorExp)

if _PY3K:
    import _string # pylint: disable=wrong-import-position, wrong-import-order

    def split_format_field_names(format_string):
        return _string.formatter_field_name_split(format_string)
else:
    def _field_iterator_convertor(iterator):
        for is_attr, key in iterator:
            if isinstance(key, numbers.Number):
                yield is_attr, int(key)
            else:
                yield is_attr, key

    def split_format_field_names(format_string):
        try:
            keyname, fielditerator = format_string._formatter_field_name_split()
        except ValueError:
            raise utils.IncompleteFormatString
        # it will return longs, instead of ints, which will complicate
        # the output
        return keyname, _field_iterator_convertor(fielditerator)


def collect_string_fields(format_string):
    """ Given a format string, return an iterator
    of all the valid format fields. It handles nested fields
    as well.
    """

    formatter = string.Formatter()
    try:
        parseiterator = formatter.parse(format_string)
        for result in parseiterator:
            if all(item is None for item in result[1:]):
                # not a replacement format
                continue
            name = result[1]
            nested = result[2]
            yield name
            if nested:
                for field in collect_string_fields(nested):
                    yield field
    except ValueError as exc:
        # Probably the format string is invalid.
        if exc.args[0].startswith("cannot switch from manual"):
            # On Jython, parsing a string with both manual
            # and automatic positions will fail with a ValueError,
            # while on CPython it will simply return the fields,
            # the validation being done in the interpreter (?).
            # We're just returning two mixed fields in order
            # to trigger the format-combined-specification check.
            yield ""
            yield "1"
            return
        raise utils.IncompleteFormatString(format_string)

def parse_format_method_string(format_string):
    """
    Parses a PEP 3101 format string, returning a tuple of
    (keys, num_args, manual_pos_arg),
    where keys is the set of mapping keys in the format string, num_args
    is the number of arguments required by the format string and
    manual_pos_arg is the number of arguments passed with the position.
    """
    keys = []
    num_args = 0
    manual_pos_arg = set()
    for name in collect_string_fields(format_string):
        if name and str(name).isdigit():
            manual_pos_arg.add(str(name))
        elif name:
            keyname, fielditerator = split_format_field_names(name)
            if isinstance(keyname, numbers.Number):
                # In Python 2 it will return long which will lead
                # to different output between 2 and 3
                manual_pos_arg.add(str(keyname))
                keyname = int(keyname)
            try:
                keys.append((keyname, list(fielditerator)))
            except ValueError:
                raise utils.IncompleteFormatString()
        else:
            num_args += 1
    return keys, num_args, len(manual_pos_arg)

def get_args(callfunc):
    """Get the arguments from the given `CallFunc` node.

    Return a tuple, where the first element is the
    number of positional arguments and the second element
    is the keyword arguments in a dict.
    """
    if callfunc.keywords:
        named = {arg.arg: utils.safe_infer(arg.value)
                 for arg in callfunc.keywords}
    else:
        named = {}
    positional = len(callfunc.args)
    return positional, named

def get_access_path(key, parts):
    """ Given a list of format specifiers, returns
    the final access path (e.g. a.b.c[0][1]).
    """
    path = []
    for is_attribute, specifier in parts:
        if is_attribute:
            path.append(".{}".format(specifier))
        else:
            path.append("[{!r}]".format(specifier))
    return str(key) + "".join(path)


class StringFormatChecker(BaseChecker):
    """Checks string formatting operations to ensure that the format string
    is valid and the arguments match the format string.
    """

    __implements__ = (IAstroidChecker,)
    name = 'string'
    msgs = MSGS

    @check_messages(*(MSGS.keys()))
    def visit_binop(self, node):
        if node.op != '%':
            return
        left = node.left
        args = node.right

        if not (isinstance(left, astroid.Const)
                and isinstance(left.value, six.string_types)):
            return
        format_string = left.value
        try:
            required_keys, required_num_args = \
                utils.parse_format_string(format_string)
        except utils.UnsupportedFormatCharacter as e:
            c = format_string[e.index]
            self.add_message('bad-format-character',
                             node=node, args=(c, ord(c), e.index))
            return
        except utils.IncompleteFormatString:
            self.add_message('truncated-format-string', node=node)
            return
        if required_keys and required_num_args:
            # The format string uses both named and unnamed format
            # specifiers.
            self.add_message('mixed-format-string', node=node)
        elif required_keys:
            # The format string uses only named format specifiers.
            # Check that the RHS of the % operator is a mapping object
            # that contains precisely the set of keys required by the
            # format string.
            if isinstance(args, astroid.Dict):
                keys = set()
                unknown_keys = False
                for k, _ in args.items:
                    if isinstance(k, astroid.Const):
                        key = k.value
                        if isinstance(key, six.string_types):
                            keys.add(key)
                        else:
                            self.add_message('bad-format-string-key',
                                             node=node, args=key)
                    else:
                        # One of the keys was something other than a
                        # constant.  Since we can't tell what it is,
                        # suppress checks for missing keys in the
                        # dictionary.
                        unknown_keys = True
                if not unknown_keys:
                    for key in required_keys:
                        if key not in keys:
                            self.add_message('missing-format-string-key',
                                             node=node, args=key)
                for key in keys:
                    if key not in required_keys:
                        self.add_message('unused-format-string-key',
                                         node=node, args=key)
            elif isinstance(args, OTHER_NODES + (astroid.Tuple,)):
                type_name = type(args).__name__
                self.add_message('format-needs-mapping',
                                 node=node, args=type_name)
            # else:
                # The RHS of the format specifier is a name or
                # expression.  It may be a mapping object, so
                # there's nothing we can check.
        else:
            # The format string uses only unnamed format specifiers.
            # Check that the number of arguments passed to the RHS of
            # the % operator matches the number required by the format
            # string.
            if isinstance(args, astroid.Tuple):
                rhs_tuple = utils.safe_infer(args)
                num_args = None
                if rhs_tuple not in (None, astroid.Uninferable):
                    num_args = len(rhs_tuple.elts)
            elif isinstance(args, OTHER_NODES + (astroid.Dict, astroid.DictComp)):
                num_args = 1
            else:
                # The RHS of the format specifier is a name or
                # expression.  It could be a tuple of unknown size, so
                # there's nothing we can check.
                num_args = None
            if num_args is not None:
                if num_args > required_num_args:
                    self.add_message('too-many-format-args', node=node)
                elif num_args < required_num_args:
                    self.add_message('too-few-format-args', node=node)


    @check_messages(*(MSGS.keys()))
    def visit_call(self, node):
        func = utils.safe_infer(node.func)
        if (isinstance(func, astroid.BoundMethod)
                and isinstance(func.bound, astroid.Instance)
                and func.bound.name in ('str', 'unicode', 'bytes')):
            if func.name in ('strip', 'lstrip', 'rstrip') and node.args:
                arg = utils.safe_infer(node.args[0])
                if not isinstance(arg, astroid.Const):
                    return
                if len(arg.value) != len(set(arg.value)):
                    self.add_message('bad-str-strip-call', node=node,
                                     args=(func.bound.name, func.name))
            elif func.name == 'format':
                if _PY27 or _PY3K:
                    self._check_new_format(node, func)

    def _check_new_format(self, node, func):
        """ Check the new string formatting. """
        # TODO: skip (for now) format nodes which don't have
        #       an explicit string on the left side of the format operation.
        #       We do this because our inference engine can't properly handle
        #       redefinitions of the original string.
        #       For more details, see issue 287.
        #
        # Note that there may not be any left side at all, if the format method
        # has been assigned to another variable. See issue 351. For example:
        #
        #    fmt = 'some string {}'.format
        #    fmt('arg')
        if (isinstance(node.func, astroid.Attribute)
                and not isinstance(node.func.expr, astroid.Const)):
            return
        try:
            strnode = next(func.bound.infer())
        except astroid.InferenceError:
            return
        if not isinstance(strnode, astroid.Const):
            return
        if not isinstance(strnode.value, six.string_types):
            return

        if node.starargs or node.kwargs:
            return
        try:
            positional, named = get_args(node)
        except astroid.InferenceError:
            return
        try:
            fields, num_args, manual_pos = parse_format_method_string(strnode.value)
        except utils.IncompleteFormatString:
            self.add_message('bad-format-string', node=node)
            return

        named_fields = set(field[0] for field in fields
                           if isinstance(field[0], six.string_types))
        if num_args and manual_pos:
            self.add_message('format-combined-specification',
                             node=node)
            return

        check_args = False
        # Consider "{[0]} {[1]}" as num_args.
        num_args += sum(1 for field in named_fields
                        if field == '')
        if named_fields:
            for field in named_fields:
                if field not in named and field:
                    self.add_message('missing-format-argument-key',
                                     node=node,
                                     args=(field, ))
            for field in named:
                if field not in named_fields:
                    self.add_message('unused-format-string-argument',
                                     node=node,
                                     args=(field, ))
            # num_args can be 0 if manual_pos is not.
            num_args = num_args or manual_pos
            if positional or num_args:
                empty = any(True for field in named_fields
                            if field == '')
                if named or empty:
                    # Verify the required number of positional arguments
                    # only if the .format got at least one keyword argument.
                    # This means that the format strings accepts both
                    # positional and named fields and we should warn
                    # when one of the them is missing or is extra.
                    check_args = True
        else:
            check_args = True
        if check_args:
            # num_args can be 0 if manual_pos is not.
            num_args = num_args or manual_pos
            if positional > num_args:
                self.add_message('too-many-format-args', node=node)
            elif positional < num_args:
                self.add_message('too-few-format-args', node=node)

        self._check_new_format_specifiers(node, fields, named)

    def _check_new_format_specifiers(self, node, fields, named):
        """
        Check attribute and index access in the format
        string ("{0.a}" and "{0[a]}").
        """
        for key, specifiers in fields:
            # Obtain the argument. If it can't be obtained
            # or infered, skip this check.
            if key == '':
                # {[0]} will have an unnamed argument, defaulting
                # to 0. It will not be present in `named`, so use the value
                # 0 for it.
                key = 0
            if isinstance(key, numbers.Number):
                try:
                    argname = utils.get_argument_from_call(node, key)
                except utils.NoSuchArgumentError:
                    continue
            else:
                if key not in named:
                    continue
                argname = named[key]
            if argname in (astroid.YES, None):
                continue
            try:
                argument = next(argname.infer())
            except astroid.InferenceError:
                continue
            if not specifiers or argument is astroid.YES:
                # No need to check this key if it doesn't
                # use attribute / item access
                continue
            if argument.parent and isinstance(argument.parent, astroid.Arguments):
                # Ignore any object coming from an argument,
                # because we can't infer its value properly.
                continue
            previous = argument
            parsed = []
            for is_attribute, specifier in specifiers:
                if previous is astroid.YES:
                    break
                parsed.append((is_attribute, specifier))
                if is_attribute:
                    try:
                        previous = previous.getattr(specifier)[0]
                    except astroid.NotFoundError:
                        if (hasattr(previous, 'has_dynamic_getattr') and
                                previous.has_dynamic_getattr()):
                            # Don't warn if the object has a custom __getattr__
                            break
                        path = get_access_path(key, parsed)
                        self.add_message('missing-format-attribute',
                                         args=(specifier, path),
                                         node=node)
                        break
                else:
                    warn_error = False
                    if hasattr(previous, 'getitem'):
                        try:
                            previous = previous.getitem(astroid.Const(specifier))
                        except (astroid.AstroidIndexError,
                                astroid.AstroidTypeError,
                                astroid.AttributeInferenceError):
                            warn_error = True
                        except astroid.InferenceError:
                            break
                        if previous is astroid.Uninferable:
                            break
                    else:
                        try:
                            # Lookup __getitem__ in the current node,
                            # but skip further checks, because we can't
                            # retrieve the looked object
                            previous.getattr('__getitem__')
                            break
                        except astroid.NotFoundError:
                            warn_error = True
                    if warn_error:
                        path = get_access_path(key, parsed)
                        self.add_message('invalid-format-index',
                                         args=(specifier, path),
                                         node=node)
                        break

                try:
                    previous = next(previous.infer())
                except astroid.InferenceError:
                    # can't check further if we can't infer it
                    break


class StringConstantChecker(BaseTokenChecker):
    """Check string literals"""
    __implements__ = (ITokenChecker, IRawChecker)
    name = 'string_constant'
    msgs = {
        'W1401': ('Anomalous backslash in string: \'%s\'. '
                  'String constant might be missing an r prefix.',
                  'anomalous-backslash-in-string',
                  'Used when a backslash is in a literal string but not as an '
                  'escape.'),
        'W1402': ('Anomalous Unicode escape in byte string: \'%s\'. '
                  'String constant might be missing an r or u prefix.',
                  'anomalous-unicode-escape-in-string',
                  'Used when an escape like \\u is encountered in a byte '
                  'string where it has no effect.'),
        }

    # Characters that have a special meaning after a backslash in either
    # Unicode or byte strings.
    ESCAPE_CHARACTERS = 'abfnrtvx\n\r\t\\\'\"01234567'

    # TODO(mbp): Octal characters are quite an edge case today; people may
    # prefer a separate warning where they occur.  \0 should be allowed.

    # Characters that have a special meaning after a backslash but only in
    # Unicode strings.
    UNICODE_ESCAPE_CHARACTERS = 'uUN'

    def process_module(self, module):
        self._unicode_literals = 'unicode_literals' in module.future_imports

    def process_tokens(self, tokens):
        for (tok_type, token, (start_row, _), _, _) in tokens:
            if tok_type == tokenize.STRING:
                # 'token' is the whole un-parsed token; we can look at the start
                # of it to see whether it's a raw or unicode string etc.
                self.process_string_token(token, start_row)

    def process_string_token(self, token, start_row):
        for i, c in enumerate(token):
            if c in '\'\"':
                quote_char = c
                break
        # pylint: disable=undefined-loop-variable
        prefix = token[:i].lower() #  markers like u, b, r.
        after_prefix = token[i:]
        if after_prefix[:3] == after_prefix[-3:] == 3 * quote_char:
            string_body = after_prefix[3:-3]
        else:
            string_body = after_prefix[1:-1]  # Chop off quotes
        # No special checks on raw strings at the moment.
        if 'r' not in prefix:
            self.process_non_raw_string_token(prefix, string_body, start_row)

    def process_non_raw_string_token(self, prefix, string_body, start_row):
        """check for bad escapes in a non-raw string.

        prefix: lowercase string of eg 'ur' string prefix markers.
        string_body: the un-parsed body of the string, not including the quote
        marks.
        start_row: integer line number in the source.
        """
        # Walk through the string; if we see a backslash then escape the next
        # character, and skip over it.  If we see a non-escaped character,
        # alert, and continue.
        #
        # Accept a backslash when it escapes a backslash, or a quote, or
        # end-of-line, or one of the letters that introduce a special escape
        # sequence <http://docs.python.org/reference/lexical_analysis.html>
        #
        # TODO(mbp): Maybe give a separate warning about the rarely-used
        # \a \b \v \f?
        #
        # TODO(mbp): We could give the column of the problem character, but
        # add_message doesn't seem to have a way to pass it through at present.
        i = 0
        while True:
            i = string_body.find('\\', i)
            if i == -1:
                break
            # There must be a next character; having a backslash at the end
            # of the string would be a SyntaxError.
            next_char = string_body[i+1]
            match = string_body[i:i+2]
            if next_char in self.UNICODE_ESCAPE_CHARACTERS:
                if 'u' in prefix:
                    pass
                elif (_PY3K or self._unicode_literals) and 'b' not in prefix:
                    pass  # unicode by default
                else:
                    self.add_message('anomalous-unicode-escape-in-string',
                                     line=start_row, args=(match, ))
            elif next_char not in self.ESCAPE_CHARACTERS:
                self.add_message('anomalous-backslash-in-string',
                                 line=start_row, args=(match, ))
            # Whether it was a valid escape or not, backslash followed by
            # another character can always be consumed whole: the second
            # character can never be the start of a new backslash escape.
            i += 2



def register(linter):
    """required method to auto register this checker """
    linter.register_checker(StringFormatChecker(linter))
    linter.register_checker(StringConstantChecker(linter))
