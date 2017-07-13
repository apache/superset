# Copyright (c) 2006-2014 LOGILAB S.A. (Paris, FRANCE) <contact@logilab.fr>
# Copyright (c) 2012-2014 Google, Inc.
# Copyright (c) 2014 Brett Cannon <brett@python.org>
# Copyright (c) 2014-2016 Claudiu Popa <pcmanticore@gmail.com>
# Copyright (c) 2015 Aru Sahni <arusahni@gmail.com>
# Copyright (c) 2015 Florian Bruhin <me@the-compiler.org>
# Copyright (c) 2016 Ashley Whetter <ashley@awhetter.co.uk>
# Copyright (c) 2016 Glenn Matthews <glenn@e-dad.net>

# Licensed under the GPL: https://www.gnu.org/licenses/old-licenses/gpl-2.0.html
# For details: https://github.com/PyCQA/pylint/blob/master/COPYING

"""some various utilities and helper classes, most of them used in the
main pylint class
"""
from __future__ import print_function

import collections
from inspect import cleandoc
import os
from os.path import dirname, basename, splitext, exists, isdir, join, normpath
import re
import sys
import tokenize
import warnings
import textwrap

import six
from six.moves import zip  # pylint: disable=redefined-builtin

from astroid import nodes, Module
from astroid import modutils

from pylint.interfaces import IRawChecker, ITokenChecker, UNDEFINED, implements
from pylint.reporters.ureports.nodes import Section
from pylint.exceptions import InvalidMessageError, UnknownMessageError, EmptyReportError


MSG_TYPES = {
    'I' : 'info',
    'C' : 'convention',
    'R' : 'refactor',
    'W' : 'warning',
    'E' : 'error',
    'F' : 'fatal'
    }
MSG_TYPES_LONG = {v: k for k, v in six.iteritems(MSG_TYPES)}

MSG_TYPES_STATUS = {
    'I' : 0,
    'C' : 16,
    'R' : 8,
    'W' : 4,
    'E' : 2,
    'F' : 1
    }

_MSG_ORDER = 'EWRCIF'
MSG_STATE_SCOPE_CONFIG = 0
MSG_STATE_SCOPE_MODULE = 1
MSG_STATE_CONFIDENCE = 2

# Allow stopping after the first semicolon encountered,
# so that an option can be continued with the reasons
# why it is active or disabled.
OPTION_RGX = re.compile(r'\s*#.*\bpylint:\s*([^;]+);{0,1}')

# The line/node distinction does not apply to fatal errors and reports.
_SCOPE_EXEMPT = 'FR'

class WarningScope(object):
    LINE = 'line-based-msg'
    NODE = 'node-based-msg'

_MsgBase = collections.namedtuple(
    '_MsgBase',
    ['msg_id', 'symbol', 'msg', 'C', 'category', 'confidence',
     'abspath', 'path', 'module', 'obj', 'line', 'column'])


class Message(_MsgBase):
    """This class represent a message to be issued by the reporters"""
    def __new__(cls, msg_id, symbol, location, msg, confidence):
        return _MsgBase.__new__(
            cls, msg_id, symbol, msg, msg_id[0], MSG_TYPES[msg_id[0]],
            confidence, *location)

    def format(self, template):
        """Format the message according to the given template.

        The template format is the one of the format method :
        cf. http://docs.python.org/2/library/string.html#formatstrings
        """
        # For some reason, _asdict on derived namedtuples does not work with
        # Python 3.4. Needs some investigation.
        return template.format(**dict(zip(self._fields, self)))


def get_module_and_frameid(node):
    """return the module name and the frame id in the module"""
    frame = node.frame()
    module, obj = '', []
    while frame:
        if isinstance(frame, Module):
            module = frame.name
        else:
            obj.append(getattr(frame, 'name', '<lambda>'))
        try:
            frame = frame.parent.frame()
        except AttributeError:
            frame = None
    obj.reverse()
    return module, '.'.join(obj)

def category_id(cid):
    cid = cid.upper()
    if cid in MSG_TYPES:
        return cid
    return MSG_TYPES_LONG.get(cid)


def _decoding_readline(stream, encoding):
    return lambda: stream.readline().decode(encoding, 'replace')


def tokenize_module(module):
    with module.stream() as stream:
        readline = stream.readline
        if sys.version_info < (3, 0):
            if module.file_encoding is not None:
                readline = _decoding_readline(stream, module.file_encoding)

            return list(tokenize.generate_tokens(readline))
        return list(tokenize.tokenize(readline))

def build_message_def(checker, msgid, msg_tuple):
    if implements(checker, (IRawChecker, ITokenChecker)):
        default_scope = WarningScope.LINE
    else:
        default_scope = WarningScope.NODE
    options = {}
    if len(msg_tuple) > 3:
        (msg, symbol, descr, options) = msg_tuple
    elif len(msg_tuple) > 2:
        (msg, symbol, descr) = msg_tuple
    else:
        # messages should have a symbol, but for backward compatibility
        # they may not.
        (msg, descr) = msg_tuple
        warnings.warn("[pylint 0.26] description of message %s doesn't include "
                      "a symbolic name" % msgid, DeprecationWarning)
        symbol = None
    options.setdefault('scope', default_scope)
    return MessageDefinition(checker, msgid, msg, descr, symbol, **options)


class MessageDefinition(object):
    def __init__(self, checker, msgid, msg, descr, symbol, scope,
                 minversion=None, maxversion=None, old_names=None):
        self.checker = checker
        if len(msgid) != 5:
            raise InvalidMessageError('Invalid message id %r' % msgid)
        if not msgid[0] in MSG_TYPES:
            raise InvalidMessageError(
                'Bad message type %s in %r' % (msgid[0], msgid))
        self.msgid = msgid
        self.msg = msg
        self.descr = descr
        self.symbol = symbol
        self.scope = scope
        self.minversion = minversion
        self.maxversion = maxversion
        self.old_names = old_names or []

    def may_be_emitted(self):
        """return True if message may be emitted using the current interpreter"""
        if self.minversion is not None and self.minversion > sys.version_info:
            return False
        if self.maxversion is not None and self.maxversion <= sys.version_info:
            return False
        return True

    def format_help(self, checkerref=False):
        """return the help string for the given message id"""
        desc = self.descr
        if checkerref:
            desc += ' This message belongs to the %s checker.' % \
                   self.checker.name
        title = self.msg
        if self.symbol:
            msgid = '%s (%s)' % (self.symbol, self.msgid)
        else:
            msgid = self.msgid
        if self.minversion or self.maxversion:
            restr = []
            if self.minversion:
                restr.append('< %s' % '.'.join([str(n) for n in self.minversion]))
            if self.maxversion:
                restr.append('>= %s' % '.'.join([str(n) for n in self.maxversion]))
            restr = ' or '.join(restr)
            if checkerref:
                desc += " It can't be emitted when using Python %s." % restr
            else:
                desc += " This message can't be emitted when using Python %s." % restr
        desc = _normalize_text(' '.join(desc.split()), indent='  ')
        if title != '%s':
            title = title.splitlines()[0]
            return ':%s: *%s*\n%s' % (msgid, title, desc)
        return ':%s:\n%s' % (msgid, desc)


class MessagesHandlerMixIn(object):
    """a mix-in class containing all the messages related methods for the main
    lint class
    """

    def __init__(self):
        self._msgs_state = {}
        self.msg_status = 0

    def _checker_messages(self, checker):
        for known_checker in self._checkers[checker.lower()]:
            for msgid in known_checker.msgs:
                yield msgid

    def disable(self, msgid, scope='package', line=None, ignore_unknown=False):
        """don't output message of the given id"""
        self._set_msg_status(msgid, enable=False, scope=scope,
                             line=line, ignore_unknown=ignore_unknown)

    def enable(self, msgid, scope='package', line=None, ignore_unknown=False):
        """reenable message of the given id"""
        self._set_msg_status(msgid, enable=True, scope=scope,
                             line=line, ignore_unknown=ignore_unknown)

    def _set_msg_status(self, msgid, enable, scope='package', line=None, ignore_unknown=False):
        assert scope in ('package', 'module')

        if msgid == 'all':
            for _msgid in MSG_TYPES:
                self._set_msg_status(_msgid, enable, scope, line, ignore_unknown)
            if enable and not self._python3_porting_mode:
                # Don't activate the python 3 porting checker if it wasn't activated explicitly.
                self.disable('python3')
            return

        # msgid is a category?
        catid = category_id(msgid)
        if catid is not None:
            for _msgid in self.msgs_store._msgs_by_category.get(catid):
                self._set_msg_status(_msgid, enable, scope, line)
            return

        # msgid is a checker name?
        if msgid.lower() in self._checkers:
            msgs_store = self.msgs_store
            for checker in self._checkers[msgid.lower()]:
                for _msgid in checker.msgs:
                    if _msgid in msgs_store._alternative_names:
                        self._set_msg_status(_msgid, enable, scope, line)
            return

        # msgid is report id?
        if msgid.lower().startswith('rp'):
            if enable:
                self.enable_report(msgid)
            else:
                self.disable_report(msgid)
            return

        try:
            # msgid is a symbolic or numeric msgid.
            msg = self.msgs_store.check_message_id(msgid)
        except UnknownMessageError:
            if ignore_unknown:
                return
            raise

        if scope == 'module':
            self.file_state.set_msg_status(msg, line, enable)
            if enable:
                self.add_message('locally-enabled', line=line,
                                 args=(msg.symbol, msg.msgid))
            elif msg.symbol != 'locally-disabled':
                self.add_message('locally-disabled', line=line,
                                 args=(msg.symbol, msg.msgid))
        else:
            msgs = self._msgs_state
            msgs[msg.msgid] = enable
            # sync configuration object
            self.config.enable = [self._message_symbol(mid) for mid, val
                                  in sorted(six.iteritems(msgs)) if val]
            self.config.disable = [self._message_symbol(mid) for mid, val
                                   in sorted(six.iteritems(msgs)) if not val]

    def _message_symbol(self, msgid):
        """Get the message symbol of the given message id

        Return the original message id if the message does not
        exist.
        """
        try:
            return self.msgs_store.check_message_id(msgid).symbol
        except UnknownMessageError:
            return msgid

    def get_message_state_scope(self, msgid, line=None, confidence=UNDEFINED):
        """Returns the scope at which a message was enabled/disabled."""
        if self.config.confidence and confidence.name not in self.config.confidence:
            return MSG_STATE_CONFIDENCE
        try:
            if line in self.file_state._module_msgs_state[msgid]:
                return MSG_STATE_SCOPE_MODULE
        except (KeyError, TypeError):
            return MSG_STATE_SCOPE_CONFIG

    def is_message_enabled(self, msg_descr, line=None, confidence=None):
        """return true if the message associated to the given message id is
        enabled

        msgid may be either a numeric or symbolic message id.
        """
        if self.config.confidence and confidence:
            if confidence.name not in self.config.confidence:
                return False
        try:
            msgid = self.msgs_store.check_message_id(msg_descr).msgid
        except UnknownMessageError:
            # The linter checks for messages that are not registered
            # due to version mismatch, just treat them as message IDs
            # for now.
            msgid = msg_descr
        if line is None:
            return self._msgs_state.get(msgid, True)
        try:
            return self.file_state._module_msgs_state[msgid][line]
        except KeyError:
            return self._msgs_state.get(msgid, True)

    def add_message(self, msg_descr, line=None, node=None, args=None, confidence=UNDEFINED):
        """Adds a message given by ID or name.

        If provided, the message string is expanded using args

        AST checkers should must the node argument (but may optionally
        provide line if the line number is different), raw and token checkers
        must provide the line argument.
        """
        msg_info = self.msgs_store.check_message_id(msg_descr)
        msgid = msg_info.msgid
        # backward compatibility, message may not have a symbol
        symbol = msg_info.symbol or msgid
        # Fatal messages and reports are special, the node/scope distinction
        # does not apply to them.
        if msgid[0] not in _SCOPE_EXEMPT:
            if msg_info.scope == WarningScope.LINE:
                if line is None:
                    raise InvalidMessageError(
                        'Message %s must provide line, got None' % msgid)
                if node is not None:
                    raise InvalidMessageError(
                        'Message %s must only provide line, '
                        'got line=%s, node=%s' % (msgid, line, node))
            elif msg_info.scope == WarningScope.NODE:
                # Node-based warnings may provide an override line.
                if node is None:
                    raise InvalidMessageError(
                        'Message %s must provide Node, got None' % msgid)

        if line is None and node is not None:
            line = node.fromlineno
        if hasattr(node, 'col_offset'):
            col_offset = node.col_offset # XXX measured in bytes for utf-8, divide by two for chars?
        else:
            col_offset = None
        # should this message be displayed
        if not self.is_message_enabled(msgid, line, confidence):
            self.file_state.handle_ignored_message(
                self.get_message_state_scope(msgid, line, confidence),
                msgid, line, node, args, confidence)
            return
        # update stats
        msg_cat = MSG_TYPES[msgid[0]]
        self.msg_status |= MSG_TYPES_STATUS[msgid[0]]
        self.stats[msg_cat] += 1
        self.stats['by_module'][self.current_name][msg_cat] += 1
        try:
            self.stats['by_msg'][symbol] += 1
        except KeyError:
            self.stats['by_msg'][symbol] = 1
        # expand message ?
        msg = msg_info.msg
        if args:
            msg %= args
        # get module and object
        if node is None:
            module, obj = self.current_name, ''
            abspath = self.current_file
        else:
            module, obj = get_module_and_frameid(node)
            abspath = node.root().file
        path = abspath.replace(self.reporter.path_strip_prefix, '')
        # add the message
        self.reporter.handle_message(
            Message(msgid, symbol,
                    (abspath, path, module, obj, line or 1, col_offset or 0), msg, confidence))

    def print_full_documentation(self, stream=None):
        """output a full documentation in ReST format"""
        if not stream:
            stream = sys.stdout

        print("Pylint global options and switches", file=stream)
        print("----------------------------------", file=stream)
        print("", file=stream)
        print("Pylint provides global options and switches.", file=stream)
        print("", file=stream)

        by_checker = {}
        for checker in self.get_checkers():
            if checker.name == 'master':
                if checker.options:
                    for section, options in checker.options_by_section():
                        if section is None:
                            title = 'General options'
                        else:
                            title = '%s options' % section.capitalize()
                        print(title, file=stream)
                        print('~' * len(title), file=stream)
                        _rest_format_section(stream, None, options)
                        print("", file=stream)
            else:
                name = checker.name
                try:
                    by_checker[name]['options'] += checker.options_and_values()
                    by_checker[name]['msgs'].update(checker.msgs)
                    by_checker[name]['reports'] += checker.reports
                except KeyError:
                    by_checker[name] = {
                        'options': list(checker.options_and_values()),
                        'msgs':    dict(checker.msgs),
                        'reports': list(checker.reports),
                    }

        print("Pylint checkers' options and switches", file=stream)
        print("-------------------------------------", file=stream)
        print("", file=stream)
        print("Pylint checkers can provide three set of features:", file=stream)
        print("", file=stream)
        print("* options that control their execution,", file=stream)
        print("* messages that they can raise,", file=stream)
        print("* reports that they can generate.", file=stream)
        print("", file=stream)
        print("Below is a list of all checkers and their features.", file=stream)
        print("", file=stream)

        for checker, info in six.iteritems(by_checker):
            self._print_checker_doc(checker, info, stream=stream)

    @staticmethod
    def _print_checker_doc(checker_name, info, stream=None):
        """Helper method for print_full_documentation.

        Also used by doc/exts/pylint_extensions.py.
        """
        if not stream:
            stream = sys.stdout

        doc = info.get('doc')
        module = info.get('module')
        msgs = info.get('msgs')
        options = info.get('options')
        reports = info.get('reports')

        title = '%s checker' % (checker_name.replace("_", " ").title())

        if module:
            # Provide anchor to link against
            print(".. _%s:\n" % module, file=stream)
        print(title, file=stream)
        print('~' * len(title), file=stream)
        print("", file=stream)
        if module:
            print("This checker is provided by ``%s``." % module, file=stream)
        print("Verbatim name of the checker is ``%s``." % checker_name, file=stream)
        print("", file=stream)
        if doc:
            title = 'Documentation'
            print(title, file=stream)
            print('^' * len(title), file=stream)
            print(cleandoc(doc), file=stream)
            print("", file=stream)
        if options:
            title = 'Options'
            print(title, file=stream)
            print('^' * len(title), file=stream)
            _rest_format_section(stream, None, options)
            print("", file=stream)
        if msgs:
            title = 'Messages'
            print(title, file=stream)
            print('^' * len(title), file=stream)
            for msgid, msg in sorted(six.iteritems(msgs),
                                     key=lambda kv: (_MSG_ORDER.index(kv[0][0]), kv[1])):
                msg = build_message_def(checker_name, msgid, msg)
                print(msg.format_help(checkerref=False), file=stream)
            print("", file=stream)
        if reports:
            title = 'Reports'
            print(title, file=stream)
            print('^' * len(title), file=stream)
            for report in reports:
                print(':%s: %s' % report[:2], file=stream)
            print("", file=stream)
        print("", file=stream)

class FileState(object):
    """Hold internal state specific to the currently analyzed file"""

    def __init__(self, modname=None):
        self.base_name = modname
        self._module_msgs_state = {}
        self._raw_module_msgs_state = {}
        self._ignored_msgs = collections.defaultdict(set)
        self._suppression_mapping = {}

    def collect_block_lines(self, msgs_store, module_node):
        """Walk the AST to collect block level options line numbers."""
        for msg, lines in six.iteritems(self._module_msgs_state):
            self._raw_module_msgs_state[msg] = lines.copy()
        orig_state = self._module_msgs_state.copy()
        self._module_msgs_state = {}
        self._suppression_mapping = {}
        self._collect_block_lines(msgs_store, module_node, orig_state)

    def _collect_block_lines(self, msgs_store, node, msg_state):
        """Recursively walk (depth first) AST to collect block level options
        line numbers.
        """
        for child in node.get_children():
            self._collect_block_lines(msgs_store, child, msg_state)
        first = node.fromlineno
        last = node.tolineno
        # first child line number used to distinguish between disable
        # which are the first child of scoped node with those defined later.
        # For instance in the code below:
        #
        # 1.   def meth8(self):
        # 2.        """test late disabling"""
        # 3.        # pylint: disable=E1102
        # 4.        print self.blip
        # 5.        # pylint: disable=E1101
        # 6.        print self.bla
        #
        # E1102 should be disabled from line 1 to 6 while E1101 from line 5 to 6
        #
        # this is necessary to disable locally messages applying to class /
        # function using their fromlineno
        if (isinstance(node, (nodes.Module, nodes.ClassDef, nodes.FunctionDef))
                and node.body):
            firstchildlineno = node.body[0].fromlineno
        else:
            firstchildlineno = last
        for msgid, lines in six.iteritems(msg_state):
            for lineno, state in list(lines.items()):
                original_lineno = lineno
                if first > lineno or last < lineno:
                    continue
                # Set state for all lines for this block, if the
                # warning is applied to nodes.
                if  msgs_store.check_message_id(msgid).scope == WarningScope.NODE:
                    if lineno > firstchildlineno:
                        state = True
                    first_, last_ = node.block_range(lineno)
                else:
                    first_ = lineno
                    last_ = last
                for line in range(first_, last_+1):
                    # do not override existing entries
                    if line in self._module_msgs_state.get(msgid, ()):
                        continue
                    if line in lines: # state change in the same block
                        state = lines[line]
                        original_lineno = line
                    if not state:
                        self._suppression_mapping[(msgid, line)] = original_lineno
                    try:
                        self._module_msgs_state[msgid][line] = state
                    except KeyError:
                        self._module_msgs_state[msgid] = {line: state}
                del lines[lineno]

    def set_msg_status(self, msg, line, status):
        """Set status (enabled/disable) for a given message at a given line"""
        assert line > 0
        try:
            self._module_msgs_state[msg.msgid][line] = status
        except KeyError:
            self._module_msgs_state[msg.msgid] = {line: status}

    def handle_ignored_message(self, state_scope, msgid, line,
                               node, args, confidence): # pylint: disable=unused-argument
        """Report an ignored message.

        state_scope is either MSG_STATE_SCOPE_MODULE or MSG_STATE_SCOPE_CONFIG,
        depending on whether the message was disabled locally in the module,
        or globally. The other arguments are the same as for add_message.
        """
        if state_scope == MSG_STATE_SCOPE_MODULE:
            try:
                orig_line = self._suppression_mapping[(msgid, line)]
                self._ignored_msgs[(msgid, orig_line)].add(line)
            except KeyError:
                pass

    def iter_spurious_suppression_messages(self, msgs_store):
        for warning, lines in six.iteritems(self._raw_module_msgs_state):
            for line, enable in six.iteritems(lines):
                if not enable and (warning, line) not in self._ignored_msgs:
                    yield 'useless-suppression', line, \
                        (msgs_store.get_msg_display_string(warning),)
        # don't use iteritems here, _ignored_msgs may be modified by add_message
        for (warning, from_), lines in list(self._ignored_msgs.items()):
            for line in lines:
                yield 'suppressed-message', line, \
                    (msgs_store.get_msg_display_string(warning), from_)


class MessagesStore(object):
    """The messages store knows information about every possible message but has
    no particular state during analysis.
    """

    def __init__(self):
        # Primary registry for all active messages (i.e. all messages
        # that can be emitted by pylint for the underlying Python
        # version). It contains the 1:1 mapping from symbolic names
        # to message definition objects.
        self._messages = {}
        # Maps alternative names (numeric IDs, deprecated names) to
        # message definitions. May contain several names for each definition
        # object.
        self._alternative_names = {}
        self._msgs_by_category = collections.defaultdict(list)

    @property
    def messages(self):
        """The list of all active messages."""
        return six.itervalues(self._messages)

    def add_renamed_message(self, old_id, old_symbol, new_symbol):
        """Register the old ID and symbol for a warning that was renamed.

        This allows users to keep using the old ID/symbol in suppressions.
        """
        msg = self.check_message_id(new_symbol)
        msg.old_names.append((old_id, old_symbol))
        self._register_alternative_name(msg, old_id)
        self._register_alternative_name(msg, old_symbol)

    def register_messages(self, checker):
        """register a dictionary of messages

        Keys are message ids, values are a 2-uple with the message type and the
        message itself

        message ids should be a string of len 4, where the two first characters
        are the checker id and the two last the message id in this checker
        """
        chkid = None
        for msgid, msg_tuple in sorted(six.iteritems(checker.msgs)):
            msg = build_message_def(checker, msgid, msg_tuple)
            # avoid duplicate / malformed ids
            if msg.symbol in self._messages or msg.symbol in self._alternative_names:
                raise InvalidMessageError(
                    'Message symbol %r is already defined' % msg.symbol)
            if chkid is not None and chkid != msg.msgid[1:3]:
                raise InvalidMessageError(
                    "Inconsistent checker part in message id %r (expected 'x%sxx')"
                    % (msgid, chkid))
            chkid = msg.msgid[1:3]
            self._messages[msg.symbol] = msg
            self._register_alternative_name(msg, msg.msgid)
            for old_id, old_symbol in msg.old_names:
                self._register_alternative_name(msg, old_id)
                self._register_alternative_name(msg, old_symbol)
            self._msgs_by_category[msg.msgid[0]].append(msg.msgid)

    def _register_alternative_name(self, msg, name):
        """helper for register_message()"""
        if name in self._messages and self._messages[name] != msg:
            raise InvalidMessageError(
                'Message symbol %r is already defined' % name)
        if name in self._alternative_names and self._alternative_names[name] != msg:
            raise InvalidMessageError(
                'Message %s %r is already defined' % (
                    'id' if len(name) == 5 and name[0] in MSG_TYPES else 'alternate name',
                    name))
        self._alternative_names[name] = msg

    def check_message_id(self, msgid):
        """returns the Message object for this message.

        msgid may be either a numeric or symbolic id.

        Raises UnknownMessageError if the message id is not defined.
        """
        if msgid[1:].isdigit():
            msgid = msgid.upper()
        for source in (self._alternative_names, self._messages):
            try:
                return source[msgid]
            except KeyError:
                pass
        raise UnknownMessageError('No such message id %s' % msgid)

    def get_msg_display_string(self, msgid):
        """Generates a user-consumable representation of a message.

        Can be just the message ID or the ID and the symbol.
        """
        return repr(self.check_message_id(msgid).symbol)

    def help_message(self, msgids):
        """display help messages for the given message identifiers"""
        for msgid in msgids:
            try:
                print(self.check_message_id(msgid).format_help(checkerref=True))
                print("")
            except UnknownMessageError as ex:
                print(ex)
                print("")
                continue

    def list_messages(self):
        """output full messages list documentation in ReST format"""
        msgs = sorted(six.itervalues(self._messages), key=lambda msg: msg.msgid)
        for msg in msgs:
            if not msg.may_be_emitted():
                continue
            print(msg.format_help(checkerref=False))
        print("")


class ReportsHandlerMixIn(object):
    """a mix-in class containing all the reports and stats manipulation
    related methods for the main lint class
    """
    def __init__(self):
        self._reports = collections.defaultdict(list)
        self._reports_state = {}

    def report_order(self):
        """ Return a list of reports, sorted in the order
        in which they must be called.
        """
        return list(self._reports)

    def register_report(self, reportid, r_title, r_cb, checker):
        """register a report

        reportid is the unique identifier for the report
        r_title the report's title
        r_cb the method to call to make the report
        checker is the checker defining the report
        """
        reportid = reportid.upper()
        self._reports[checker].append((reportid, r_title, r_cb))

    def enable_report(self, reportid):
        """disable the report of the given id"""
        reportid = reportid.upper()
        self._reports_state[reportid] = True

    def disable_report(self, reportid):
        """disable the report of the given id"""
        reportid = reportid.upper()
        self._reports_state[reportid] = False

    def report_is_enabled(self, reportid):
        """return true if the report associated to the given identifier is
        enabled
        """
        return self._reports_state.get(reportid, True)

    def make_reports(self, stats, old_stats):
        """render registered reports"""
        sect = Section('Report',
                       '%s statements analysed.'% (self.stats['statement']))
        for checker in self.report_order():
            for reportid, r_title, r_cb in self._reports[checker]:
                if not self.report_is_enabled(reportid):
                    continue
                report_sect = Section(r_title)
                try:
                    r_cb(report_sect, stats, old_stats)
                except EmptyReportError:
                    continue
                report_sect.report_id = reportid
                sect.append(report_sect)
        return sect

    def add_stats(self, **kwargs):
        """add some stats entries to the statistic dictionary
        raise an AssertionError if there is a key conflict
        """
        for key, value in six.iteritems(kwargs):
            if key[-1] == '_':
                key = key[:-1]
            assert key not in self.stats
            self.stats[key] = value
        return self.stats

def _basename_in_blacklist_re(base_name, black_list_re):
    """Determines if the basename is matched in a regex blacklist

    :param str base_name: The basename of the file
    :param list black_list_re: A collection of regex patterns to match against.
        Successful matches are blacklisted.

    :returns: `True` if the basename is blacklisted, `False` otherwise.
    :rtype: bool
    """
    for file_pattern in black_list_re:
        if file_pattern.match(base_name):
            return True
    return False

def _modpath_from_file(filename, is_namespace):
    def _is_package_cb(path, parts):
        return modutils.check_modpath_has_init(path, parts) or is_namespace

    return modutils.modpath_from_file_with_callback(filename, is_package_cb=_is_package_cb)


def expand_modules(files_or_modules, black_list, black_list_re):
    """take a list of files/modules/packages and return the list of tuple
    (file, module name) which have to be actually checked
    """
    result = []
    errors = []
    for something in files_or_modules:
        if exists(something):
            # this is a file or a directory
            try:
                modname = '.'.join(modutils.modpath_from_file(something))
            except ImportError:
                modname = splitext(basename(something))[0]
            if isdir(something):
                filepath = join(something, '__init__.py')
            else:
                filepath = something
        else:
            # suppose it's a module or package
            modname = something
            try:
                filepath = modutils.file_from_modpath(modname.split('.'))
                if filepath is None:
                    continue
            except (ImportError, SyntaxError) as ex:
                # FIXME p3k : the SyntaxError is a Python bug and should be
                # removed as soon as possible http://bugs.python.org/issue10588
                errors.append({'key': 'fatal', 'mod': modname, 'ex': ex})
                continue

        filepath = normpath(filepath)
        modparts = (modname or something).split('.')

        try:
            spec = modutils.file_info_from_modpath(modparts, path=sys.path)
        except ImportError:
            # Might not be acceptable, don't crash.
            is_namespace = False
            is_directory = isdir(something)
        else:
            is_namespace = modutils.is_namespace(spec)
            is_directory = modutils.is_directory(spec)

        if not is_namespace:
            result.append({'path': filepath, 'name': modname, 'isarg': True,
                           'basepath': filepath, 'basename': modname})

        has_init = (not (modname.endswith('.__init__') or modname == '__init__')
                    and '__init__.py' in filepath)

        if has_init or is_namespace or is_directory:
            for subfilepath in modutils.get_module_files(dirname(filepath), black_list,
                                                         list_all=is_namespace):
                if filepath == subfilepath:
                    continue
                if _basename_in_blacklist_re(basename(subfilepath), black_list_re):
                    continue

                modpath = _modpath_from_file(subfilepath, is_namespace)
                submodname = '.'.join(modpath)
                result.append({'path': subfilepath, 'name': submodname,
                               'isarg': False,
                               'basepath': filepath, 'basename': modname})
    return result, errors


class PyLintASTWalker(object):

    def __init__(self, linter):
        # callbacks per node types
        self.nbstatements = 0
        self.visit_events = collections.defaultdict(list)
        self.leave_events = collections.defaultdict(list)
        self.linter = linter

    def _is_method_enabled(self, method):
        if not hasattr(method, 'checks_msgs'):
            return True
        for msg_desc in method.checks_msgs:
            if self.linter.is_message_enabled(msg_desc):
                return True
        return False

    def add_checker(self, checker):
        """walk to the checker's dir and collect visit and leave methods"""
        # XXX : should be possible to merge needed_checkers and add_checker
        vcids = set()
        lcids = set()
        visits = self.visit_events
        leaves = self.leave_events
        for member in dir(checker):
            cid = member[6:]
            if cid == 'default':
                continue
            if member.startswith('visit_'):
                v_meth = getattr(checker, member)
                # don't use visit_methods with no activated message:
                if self._is_method_enabled(v_meth):
                    visits[cid].append(v_meth)
                    vcids.add(cid)
            elif member.startswith('leave_'):
                l_meth = getattr(checker, member)
                # don't use leave_methods with no activated message:
                if self._is_method_enabled(l_meth):
                    leaves[cid].append(l_meth)
                    lcids.add(cid)
        visit_default = getattr(checker, 'visit_default', None)
        if visit_default:
            for cls in nodes.ALL_NODE_CLASSES:
                cid = cls.__name__.lower()
                if cid not in vcids:
                    visits[cid].append(visit_default)
        # for now we have no "leave_default" method in Pylint

    def walk(self, astroid):
        """call visit events of astroid checkers for the given node, recurse on
        its children, then leave events.
        """
        cid = astroid.__class__.__name__.lower()

        # Detect if the node is a new name for a deprecated alias.
        # In this case, favour the methods for the deprecated
        # alias if any,  in order to maintain backwards
        # compatibility.
        visit_events = ()
        leave_events = ()

        visit_events = self.visit_events.get(cid, ())
        leave_events = self.leave_events.get(cid, ())

        if astroid.is_statement:
            self.nbstatements += 1
        # generate events for this node on each checker
        for cb in visit_events or ():
            cb(astroid)
        # recurse on children
        for child in astroid.get_children():
            self.walk(child)
        for cb in leave_events or ():
            cb(astroid)


PY_EXTS = ('.py', '.pyc', '.pyo', '.pyw', '.so', '.dll')

def register_plugins(linter, directory):
    """load all module and package in the given directory, looking for a
    'register' function in each one, used to register pylint checkers
    """
    imported = {}
    for filename in os.listdir(directory):
        base, extension = splitext(filename)
        if base in imported or base == '__pycache__':
            continue
        if extension in PY_EXTS and base != '__init__' or (
                not extension and isdir(join(directory, base))):
            try:
                module = modutils.load_module_from_file(join(directory, filename))
            except ValueError:
                # empty module name (usually emacs auto-save files)
                continue
            except ImportError as exc:
                print("Problem importing module %s: %s" % (filename, exc),
                      file=sys.stderr)
            else:
                if hasattr(module, 'register'):
                    module.register(linter)
                    imported[base] = 1

def get_global_option(checker, option, default=None):
    """ Retrieve an option defined by the given *checker* or
    by all known option providers.

    It will look in the list of all options providers
    until the given *option* will be found.
    If the option wasn't found, the *default* value will be returned.
    """
    # First, try in the given checker's config.
    # After that, look in the options providers.

    try:
        return getattr(checker.config, option.replace("-", "_"))
    except AttributeError:
        pass
    for provider in checker.linter.options_providers:
        for options in provider.options:
            if options[0] == option:
                return getattr(provider.config, option.replace("-", "_"))
    return default


def deprecated_option(shortname=None, opt_type=None, help_msg=None, deprecation_msg=None):
    def _warn_deprecated(option, optname, *args): # pylint: disable=unused-argument
        if deprecation_msg:
            sys.stderr.write(deprecation_msg % (optname,))

    option = {
        'help': help_msg,
        'hide': True,
        'type': opt_type,
        'action': 'callback',
        'callback': _warn_deprecated,
        'deprecated': True
    }
    if shortname:
        option['shortname'] = shortname
    return option


def _splitstrip(string, sep=','):
    """return a list of stripped string by splitting the string given as
    argument on `sep` (',' by default). Empty string are discarded.

    >>> _splitstrip('a, b, c   ,  4,,')
    ['a', 'b', 'c', '4']
    >>> _splitstrip('a')
    ['a']
    >>>

    :type string: str or unicode
    :param string: a csv line

    :type sep: str or unicode
    :param sep: field separator, default to the comma (',')

    :rtype: str or unicode
    :return: the unquoted string (or the input string if it wasn't quoted)
    """
    return [word.strip() for word in string.split(sep) if word.strip()]


def _unquote(string):
    """remove optional quotes (simple or double) from the string

    :type string: str or unicode
    :param string: an optionally quoted string

    :rtype: str or unicode
    :return: the unquoted string (or the input string if it wasn't quoted)
    """
    if not string:
        return string
    if string[0] in '"\'':
        string = string[1:]
    if string[-1] in '"\'':
        string = string[:-1]
    return string


def _normalize_text(text, line_len=80, indent=''):
    """Wrap the text on the given line length."""
    return '\n'.join(textwrap.wrap(text, width=line_len, initial_indent=indent,
                                   subsequent_indent=indent))


def _check_csv(value):
    if isinstance(value, (list, tuple)):
        return value
    return _splitstrip(value)


if six.PY2:
    def _encode(string, encoding):
        # pylint: disable=undefined-variable
        if isinstance(string, unicode):
            return string.encode(encoding)
        return str(string)
else:
    def _encode(string, _):
        return str(string)

def _get_encoding(encoding, stream):
    encoding = encoding or getattr(stream, 'encoding', None)
    if not encoding:
        import locale
        encoding = locale.getpreferredencoding()
    return encoding


def _comment(string):
    """return string as a comment"""
    lines = [line.strip() for line in string.splitlines()]
    return '# ' + ('%s# ' % os.linesep).join(lines)


def _format_option_value(optdict, value):
    """return the user input's value from a 'compiled' value"""
    if isinstance(value, (list, tuple)):
        value = ','.join(_format_option_value(optdict, item) for item in value)
    elif isinstance(value, dict):
        value = ','.join('%s:%s' % (k, v) for k, v in value.items())
    elif hasattr(value, 'match'): # optdict.get('type') == 'regexp'
        # compiled regexp
        value = value.pattern
    elif optdict.get('type') == 'yn':
        value = 'yes' if value else 'no'
    elif isinstance(value, six.string_types) and value.isspace():
        value = "'%s'" % value
    return value


def _ini_format_section(stream, section, options, encoding=None, doc=None):
    """format an options section using the INI format"""
    encoding = _get_encoding(encoding, stream)
    if doc:
        print(_encode(_comment(doc), encoding), file=stream)
    print('[%s]' % section, file=stream)
    _ini_format(stream, options, encoding)


def _ini_format(stream, options, encoding):
    """format options using the INI format"""
    for optname, optdict, value in options:
        value = _format_option_value(optdict, value)
        help = optdict.get('help')
        if help:
            help = _normalize_text(help, line_len=79, indent='# ')
            print(file=stream)
            print(_encode(help, encoding), file=stream)
        else:
            print(file=stream)
        if value is None:
            print('#%s=' % optname, file=stream)
        else:
            value = _encode(value, encoding).strip()
            print('%s=%s' % (optname, value), file=stream)

format_section = _ini_format_section


def _rest_format_section(stream, section, options, encoding=None, doc=None):
    """format an options section using as ReST formatted output"""
    encoding = _get_encoding(encoding, stream)
    if section:
        print('%s\n%s' % (section, "'"*len(section)), file=stream)
    if doc:
        print(_encode(_normalize_text(doc, line_len=79, indent=''), encoding), file=stream)
        print(file=stream)
    for optname, optdict, value in options:
        help = optdict.get('help')
        print(':%s:' % optname, file=stream)
        if help:
            help = _normalize_text(help, line_len=79, indent='  ')
            print(_encode(help, encoding), file=stream)
        if value:
            value = _encode(_format_option_value(optdict, value), encoding)
            print(file=stream)
            print('  Default: ``%s``' % value.replace("`` ", "```` ``"), file=stream)
