# Licensed under the Apache License: http://www.apache.org/licenses/LICENSE-2.0
# For details: https://bitbucket.org/ned/coveragepy/src/default/NOTICE.txt

"""Code parsing for coverage.py."""

import ast
import collections
import os
import re
import token
import tokenize

from coverage import env
from coverage.backward import range    # pylint: disable=redefined-builtin
from coverage.backward import bytes_to_ints, string_class
from coverage.bytecode import CodeObjects
from coverage.debug import short_stack
from coverage.misc import contract, join_regex, new_contract, nice_pair, one_of
from coverage.misc import NoSource, NotPython, StopEverything
from coverage.phystokens import compile_unicode, generate_tokens, neuter_encoding_declaration


class PythonParser(object):
    """Parse code to find executable lines, excluded lines, etc.

    This information is all based on static analysis: no code execution is
    involved.

    """
    @contract(text='unicode|None')
    def __init__(self, text=None, filename=None, exclude=None):
        """
        Source can be provided as `text`, the text itself, or `filename`, from
        which the text will be read.  Excluded lines are those that match
        `exclude`, a regex.

        """
        assert text or filename, "PythonParser needs either text or filename"
        self.filename = filename or "<code>"
        self.text = text
        if not self.text:
            from coverage.python import get_python_source
            try:
                self.text = get_python_source(self.filename)
            except IOError as err:
                raise NoSource(
                    "No source for code: '%s': %s" % (self.filename, err)
                )

        self.exclude = exclude

        # The text lines of the parsed code.
        self.lines = self.text.split('\n')

        # The normalized line numbers of the statements in the code. Exclusions
        # are taken into account, and statements are adjusted to their first
        # lines.
        self.statements = set()

        # The normalized line numbers of the excluded lines in the code,
        # adjusted to their first lines.
        self.excluded = set()

        # The raw_* attributes are only used in this class, and in
        # lab/parser.py to show how this class is working.

        # The line numbers that start statements, as reported by the line
        # number table in the bytecode.
        self.raw_statements = set()

        # The raw line numbers of excluded lines of code, as marked by pragmas.
        self.raw_excluded = set()

        # The line numbers of class and function definitions.
        self.raw_classdefs = set()

        # The line numbers of docstring lines.
        self.raw_docstrings = set()

        # Internal detail, used by lab/parser.py.
        self.show_tokens = False

        # A dict mapping line numbers to lexical statement starts for
        # multi-line statements.
        self._multiline = {}

        # Lazily-created ByteParser, arc data, and missing arc descriptions.
        self._byte_parser = None
        self._all_arcs = None
        self._missing_arc_fragments = None

    @property
    def byte_parser(self):
        """Create a ByteParser on demand."""
        if not self._byte_parser:
            self._byte_parser = ByteParser(self.text, filename=self.filename)
        return self._byte_parser

    def lines_matching(self, *regexes):
        """Find the lines matching one of a list of regexes.

        Returns a set of line numbers, the lines that contain a match for one
        of the regexes in `regexes`.  The entire line needn't match, just a
        part of it.

        """
        combined = join_regex(regexes)
        if env.PY2:
            combined = combined.decode("utf8")
        regex_c = re.compile(combined)
        matches = set()
        for i, ltext in enumerate(self.lines, start=1):
            if regex_c.search(ltext):
                matches.add(i)
        return matches

    def _raw_parse(self):
        """Parse the source to find the interesting facts about its lines.

        A handful of attributes are updated.

        """
        # Find lines which match an exclusion pattern.
        if self.exclude:
            self.raw_excluded = self.lines_matching(self.exclude)

        # Tokenize, to find excluded suites, to find docstrings, and to find
        # multi-line statements.
        indent = 0
        exclude_indent = 0
        excluding = False
        excluding_decorators = False
        prev_toktype = token.INDENT
        first_line = None
        empty = True
        first_on_line = True

        tokgen = generate_tokens(self.text)
        for toktype, ttext, (slineno, _), (elineno, _), ltext in tokgen:
            if self.show_tokens:                # pragma: debugging
                print("%10s %5s %-20r %r" % (
                    tokenize.tok_name.get(toktype, toktype),
                    nice_pair((slineno, elineno)), ttext, ltext
                ))
            if toktype == token.INDENT:
                indent += 1
            elif toktype == token.DEDENT:
                indent -= 1
            elif toktype == token.NAME:
                if ttext == 'class':
                    # Class definitions look like branches in the bytecode, so
                    # we need to exclude them.  The simplest way is to note the
                    # lines with the 'class' keyword.
                    self.raw_classdefs.add(slineno)
            elif toktype == token.OP:
                if ttext == ':':
                    should_exclude = (elineno in self.raw_excluded) or excluding_decorators
                    if not excluding and should_exclude:
                        # Start excluding a suite.  We trigger off of the colon
                        # token so that the #pragma comment will be recognized on
                        # the same line as the colon.
                        self.raw_excluded.add(elineno)
                        exclude_indent = indent
                        excluding = True
                        excluding_decorators = False
                elif ttext == '@' and first_on_line:
                    # A decorator.
                    if elineno in self.raw_excluded:
                        excluding_decorators = True
                    if excluding_decorators:
                        self.raw_excluded.add(elineno)
            elif toktype == token.STRING and prev_toktype == token.INDENT:
                # Strings that are first on an indented line are docstrings.
                # (a trick from trace.py in the stdlib.) This works for
                # 99.9999% of cases.  For the rest (!) see:
                # http://stackoverflow.com/questions/1769332/x/1769794#1769794
                self.raw_docstrings.update(range(slineno, elineno+1))
            elif toktype == token.NEWLINE:
                if first_line is not None and elineno != first_line:
                    # We're at the end of a line, and we've ended on a
                    # different line than the first line of the statement,
                    # so record a multi-line range.
                    for l in range(first_line, elineno+1):
                        self._multiline[l] = first_line
                first_line = None
                first_on_line = True

            if ttext.strip() and toktype != tokenize.COMMENT:
                # A non-whitespace token.
                empty = False
                if first_line is None:
                    # The token is not whitespace, and is the first in a
                    # statement.
                    first_line = slineno
                    # Check whether to end an excluded suite.
                    if excluding and indent <= exclude_indent:
                        excluding = False
                    if excluding:
                        self.raw_excluded.add(elineno)
                    first_on_line = False

            prev_toktype = toktype

        # Find the starts of the executable statements.
        if not empty:
            self.raw_statements.update(self.byte_parser._find_statements())

    def first_line(self, line):
        """Return the first line number of the statement including `line`."""
        return self._multiline.get(line, line)

    def first_lines(self, lines):
        """Map the line numbers in `lines` to the correct first line of the
        statement.

        Returns a set of the first lines.

        """
        return set(self.first_line(l) for l in lines)

    def translate_lines(self, lines):
        """Implement `FileReporter.translate_lines`."""
        return self.first_lines(lines)

    def translate_arcs(self, arcs):
        """Implement `FileReporter.translate_arcs`."""
        return [(self.first_line(a), self.first_line(b)) for (a, b) in arcs]

    def parse_source(self):
        """Parse source text to find executable lines, excluded lines, etc.

        Sets the .excluded and .statements attributes, normalized to the first
        line of multi-line statements.

        """
        try:
            self._raw_parse()
        except (tokenize.TokenError, IndentationError) as err:
            if hasattr(err, "lineno"):
                lineno = err.lineno         # IndentationError
            else:
                lineno = err.args[1][0]     # TokenError
            raise NotPython(
                u"Couldn't parse '%s' as Python source: '%s' at line %d" % (
                    self.filename, err.args[0], lineno
                )
            )

        self.excluded = self.first_lines(self.raw_excluded)

        ignore = self.excluded | self.raw_docstrings
        starts = self.raw_statements - ignore
        self.statements = self.first_lines(starts) - ignore

    def arcs(self):
        """Get information about the arcs available in the code.

        Returns a set of line number pairs.  Line numbers have been normalized
        to the first line of multi-line statements.

        """
        if self._all_arcs is None:
            self._analyze_ast()
        return self._all_arcs

    def _analyze_ast(self):
        """Run the AstArcAnalyzer and save its results.

        `_all_arcs` is the set of arcs in the code.

        """
        aaa = AstArcAnalyzer(self.text, self.raw_statements, self._multiline)
        aaa.analyze()

        self._all_arcs = set()
        for l1, l2 in aaa.arcs:
            fl1 = self.first_line(l1)
            fl2 = self.first_line(l2)
            if fl1 != fl2:
                self._all_arcs.add((fl1, fl2))

        self._missing_arc_fragments = aaa.missing_arc_fragments

    def exit_counts(self):
        """Get a count of exits from that each line.

        Excluded lines are excluded.

        """
        exit_counts = collections.defaultdict(int)
        for l1, l2 in self.arcs():
            if l1 < 0:
                # Don't ever report -1 as a line number
                continue
            if l1 in self.excluded:
                # Don't report excluded lines as line numbers.
                continue
            if l2 in self.excluded:
                # Arcs to excluded lines shouldn't count.
                continue
            exit_counts[l1] += 1

        # Class definitions have one extra exit, so remove one for each:
        for l in self.raw_classdefs:
            # Ensure key is there: class definitions can include excluded lines.
            if l in exit_counts:
                exit_counts[l] -= 1

        return exit_counts

    def missing_arc_description(self, start, end, executed_arcs=None):
        """Provide an English sentence describing a missing arc."""
        if self._missing_arc_fragments is None:
            self._analyze_ast()

        actual_start = start

        if (
            executed_arcs and
            end < 0 and end == -start and
            (end, start) not in executed_arcs and
            (end, start) in self._missing_arc_fragments
        ):
            # It's a one-line callable, and we never even started it,
            # and we have a message about not starting it.
            start, end = end, start

        fragment_pairs = self._missing_arc_fragments.get((start, end), [(None, None)])

        msgs = []
        for fragment_pair in fragment_pairs:
            smsg, emsg = fragment_pair

            if emsg is None:
                if end < 0:
                    # Hmm, maybe we have a one-line callable, let's check.
                    if (-end, end) in self._missing_arc_fragments:
                        return self.missing_arc_description(-end, end)
                    emsg = "didn't jump to the function exit"
                else:
                    emsg = "didn't jump to line {lineno}"
            emsg = emsg.format(lineno=end)

            msg = "line {start} {emsg}".format(start=actual_start, emsg=emsg)
            if smsg is not None:
                msg += ", because {smsg}".format(smsg=smsg.format(lineno=actual_start))

            msgs.append(msg)

        return " or ".join(msgs)


class ByteParser(object):
    """Parse bytecode to understand the structure of code."""

    @contract(text='unicode')
    def __init__(self, text, code=None, filename=None):
        self.text = text
        if code:
            self.code = code
        else:
            try:
                self.code = compile_unicode(text, filename, "exec")
            except SyntaxError as synerr:
                raise NotPython(
                    u"Couldn't parse '%s' as Python source: '%s' at line %d" % (
                        filename, synerr.msg, synerr.lineno
                    )
                )

        # Alternative Python implementations don't always provide all the
        # attributes on code objects that we need to do the analysis.
        for attr in ['co_lnotab', 'co_firstlineno']:
            if not hasattr(self.code, attr):
                raise StopEverything(                   # pragma: only jython
                    "This implementation of Python doesn't support code analysis.\n"
                    "Run coverage.py under another Python for this command."
                )

    def child_parsers(self):
        """Iterate over all the code objects nested within this one.

        The iteration includes `self` as its first value.

        """
        children = CodeObjects(self.code)
        return (ByteParser(self.text, code=c) for c in children)

    def _bytes_lines(self):
        """Map byte offsets to line numbers in `code`.

        Uses co_lnotab described in Python/compile.c to map byte offsets to
        line numbers.  Produces a sequence: (b0, l0), (b1, l1), ...

        Only byte offsets that correspond to line numbers are included in the
        results.

        """
        # Adapted from dis.py in the standard library.
        byte_increments = bytes_to_ints(self.code.co_lnotab[0::2])
        line_increments = bytes_to_ints(self.code.co_lnotab[1::2])

        last_line_num = None
        line_num = self.code.co_firstlineno
        byte_num = 0
        for byte_incr, line_incr in zip(byte_increments, line_increments):
            if byte_incr:
                if line_num != last_line_num:
                    yield (byte_num, line_num)
                    last_line_num = line_num
                byte_num += byte_incr
            line_num += line_incr
        if line_num != last_line_num:
            yield (byte_num, line_num)

    def _find_statements(self):
        """Find the statements in `self.code`.

        Produce a sequence of line numbers that start statements.  Recurses
        into all code objects reachable from `self.code`.

        """
        for bp in self.child_parsers():
            # Get all of the lineno information from this code.
            for _, l in bp._bytes_lines():
                yield l


#
# AST analysis
#

class LoopBlock(object):
    """A block on the block stack representing a `for` or `while` loop."""
    @contract(start=int)
    def __init__(self, start):
        # The line number where the loop starts.
        self.start = start
        # A set of ArcStarts, the arcs from break statements exiting this loop.
        self.break_exits = set()


class FunctionBlock(object):
    """A block on the block stack representing a function definition."""
    @contract(start=int, name=str)
    def __init__(self, start, name):
        # The line number where the function starts.
        self.start = start
        # The name of the function.
        self.name = name


class TryBlock(object):
    """A block on the block stack representing a `try` block."""
    @contract(handler_start='int|None', final_start='int|None')
    def __init__(self, handler_start, final_start):
        # The line number of the first "except" handler, if any.
        self.handler_start = handler_start
        # The line number of the "finally:" clause, if any.
        self.final_start = final_start

        # The ArcStarts for breaks/continues/returns/raises inside the "try:"
        # that need to route through the "finally:" clause.
        self.break_from = set()
        self.continue_from = set()
        self.return_from = set()
        self.raise_from = set()


class ArcStart(collections.namedtuple("Arc", "lineno, cause")):
    """The information needed to start an arc.

    `lineno` is the line number the arc starts from.

    `cause` is an English text fragment used as the `startmsg` for
    AstArcAnalyzer.missing_arc_fragments.  It will be used to describe why an
    arc wasn't executed, so should fit well into a sentence of the form,
    "Line 17 didn't run because {cause}."  The fragment can include "{lineno}"
    to have `lineno` interpolated into it.

    """
    def __new__(cls, lineno, cause=None):
        return super(ArcStart, cls).__new__(cls, lineno, cause)


# Define contract words that PyContract doesn't have.
# ArcStarts is for a list or set of ArcStart's.
new_contract('ArcStarts', lambda seq: all(isinstance(x, ArcStart) for x in seq))


# Turn on AST dumps with an environment variable.
AST_DUMP = bool(int(os.environ.get("COVERAGE_AST_DUMP", 0)))

class NodeList(object):
    """A synthetic fictitious node, containing a sequence of nodes.

    This is used when collapsing optimized if-statements, to represent the
    unconditional execution of one of the clauses.

    """
    def __init__(self, body):
        self.body = body
        self.lineno = body[0].lineno


class AstArcAnalyzer(object):
    """Analyze source text with an AST to find executable code paths."""

    @contract(text='unicode', statements=set)
    def __init__(self, text, statements, multiline):
        self.root_node = ast.parse(neuter_encoding_declaration(text))
        # TODO: I think this is happening in too many places.
        self.statements = set(multiline.get(l, l) for l in statements)
        self.multiline = multiline

        if AST_DUMP:                                # pragma: debugging
            # Dump the AST so that failing tests have helpful output.
            print("Statements: {0}".format(self.statements))
            print("Multiline map: {0}".format(self.multiline))
            ast_dump(self.root_node)

        self.arcs = set()

        # A map from arc pairs to a list of pairs of sentence fragments:
        #   { (start, end): [(startmsg, endmsg), ...], }
        #
        # For an arc from line 17, they should be usable like:
        #    "Line 17 {endmsg}, because {startmsg}"
        self.missing_arc_fragments = collections.defaultdict(list)
        self.block_stack = []

        self.debug = bool(int(os.environ.get("COVERAGE_TRACK_ARCS", 0)))

    def analyze(self):
        """Examine the AST tree from `root_node` to determine possible arcs.

        This sets the `arcs` attribute to be a set of (from, to) line number
        pairs.

        """
        for node in ast.walk(self.root_node):
            node_name = node.__class__.__name__
            code_object_handler = getattr(self, "_code_object__" + node_name, None)
            if code_object_handler is not None:
                code_object_handler(node)

    def add_arc(self, start, end, smsg=None, emsg=None):
        """Add an arc, including message fragments to use if it is missing."""
        if self.debug:                      # pragma: debugging
            print("\nAdding arc: ({}, {}): {!r}, {!r}".format(start, end, smsg, emsg))
            print(short_stack(limit=6))
        self.arcs.add((start, end))

        if smsg is not None or emsg is not None:
            self.missing_arc_fragments[(start, end)].append((smsg, emsg))

    def nearest_blocks(self):
        """Yield the blocks in nearest-to-farthest order."""
        return reversed(self.block_stack)

    @contract(returns=int)
    def line_for_node(self, node):
        """What is the right line number to use for this node?

        This dispatches to _line__Node functions where needed.

        """
        node_name = node.__class__.__name__
        handler = getattr(self, "_line__" + node_name, None)
        if handler is not None:
            return handler(node)
        else:
            return node.lineno

    def _line__Assign(self, node):
        return self.line_for_node(node.value)

    def _line__Dict(self, node):
        # Python 3.5 changed how dict literals are made.
        if env.PYVERSION >= (3, 5) and node.keys:
            if node.keys[0] is not None:
                return node.keys[0].lineno
            else:
                # Unpacked dict literals `{**{'a':1}}` have None as the key,
                # use the value in that case.
                return node.values[0].lineno
        else:
            return node.lineno

    def _line__List(self, node):
        if node.elts:
            return self.line_for_node(node.elts[0])
        else:
            return node.lineno

    def _line__Module(self, node):
        if node.body:
            return self.line_for_node(node.body[0])
        else:
            # Empty modules have no line number, they always start at 1.
            return 1

    # The node types that just flow to the next node with no complications.
    OK_TO_DEFAULT = set([
        "Assign", "Assert", "AugAssign", "Delete", "Exec", "Expr", "Global",
        "Import", "ImportFrom", "Nonlocal", "Pass", "Print",
    ])

    @contract(returns='ArcStarts')
    def add_arcs(self, node):
        """Add the arcs for `node`.

        Return a set of ArcStarts, exits from this node to the next. Because a
        node represents an entire sub-tree (including its children), the exits
        from a node can be arbitrarily complex::

            if something(1):
                if other(2):
                    doit(3)
                else:
                    doit(5)

        There are two exits from line 1: they start at line 3 and line 5.

        """
        node_name = node.__class__.__name__
        handler = getattr(self, "_handle__" + node_name, None)
        if handler is not None:
            return handler(node)
        else:
            # No handler: either it's something that's ok to default (a simple
            # statement), or it's something we overlooked. Change this 0 to 1
            # to see if it's overlooked.
            if 0:
                if node_name not in self.OK_TO_DEFAULT:
                    print("*** Unhandled: {0}".format(node))

            # Default for simple statements: one exit from this node.
            return set([ArcStart(self.line_for_node(node))])

    @one_of("from_start, prev_starts")
    @contract(returns='ArcStarts')
    def add_body_arcs(self, body, from_start=None, prev_starts=None):
        """Add arcs for the body of a compound statement.

        `body` is the body node.  `from_start` is a single `ArcStart` that can
        be the previous line in flow before this body.  `prev_starts` is a set
        of ArcStarts that can be the previous line.  Only one of them should be
        given.

        Returns a set of ArcStarts, the exits from this body.

        """
        if prev_starts is None:
            prev_starts = set([from_start])
        for body_node in body:
            lineno = self.line_for_node(body_node)
            first_line = self.multiline.get(lineno, lineno)
            if first_line not in self.statements:
                body_node = self.find_non_missing_node(body_node)
                if body_node is None:
                    continue
                lineno = self.line_for_node(body_node)
            for prev_start in prev_starts:
                self.add_arc(prev_start.lineno, lineno, prev_start.cause)
            prev_starts = self.add_arcs(body_node)
        return prev_starts

    def find_non_missing_node(self, node):
        """Search `node` looking for a child that has not been optimized away.

        This might return the node you started with, or it will work recursively
        to find a child node in self.statements.

        Returns a node, or None if none of the node remains.

        """
        # This repeats work just done in add_body_arcs, but this duplication
        # means we can avoid a function call in the 99.9999% case of not
        # optimizing away statements.
        lineno = self.line_for_node(node)
        first_line = self.multiline.get(lineno, lineno)
        if first_line in self.statements:
            return node

        missing_fn = getattr(self, "_missing__" + node.__class__.__name__, None)
        if missing_fn:
            node = missing_fn(node)
        else:
            node = None
        return node

    def _missing__If(self, node):
        # If the if-node is missing, then one of its children might still be
        # here, but not both. So return the first of the two that isn't missing.
        # Use a NodeList to hold the clauses as a single node.
        non_missing = self.find_non_missing_node(NodeList(node.body))
        if non_missing:
            return non_missing
        if node.orelse:
            return self.find_non_missing_node(NodeList(node.orelse))
        return None

    def _missing__NodeList(self, node):
        # A NodeList might be a mixture of missing and present nodes. Find the
        # ones that are present.
        non_missing_children = []
        for child in node.body:
            child = self.find_non_missing_node(child)
            if child is not None:
                non_missing_children.append(child)

        # Return the simplest representation of the present children.
        if not non_missing_children:
            return None
        if len(non_missing_children) == 1:
            return non_missing_children[0]
        return NodeList(non_missing_children)

    def is_constant_expr(self, node):
        """Is this a compile-time constant?"""
        node_name = node.__class__.__name__
        if node_name in ["NameConstant", "Num"]:
            return "Num"
        elif node_name == "Name":
            if node.id in ["True", "False", "None", "__debug__"]:
                return "Name"
        return None

    # In the fullness of time, these might be good tests to write:
    #   while EXPR:
    #   while False:
    #   listcomps hidden deep in other expressions
    #   listcomps hidden in lists: x = [[i for i in range(10)]]
    #   nested function definitions


    # Exit processing: process_*_exits
    #
    # These functions process the four kinds of jump exits: break, continue,
    # raise, and return.  To figure out where an exit goes, we have to look at
    # the block stack context.  For example, a break will jump to the nearest
    # enclosing loop block, or the nearest enclosing finally block, whichever
    # is nearer.

    @contract(exits='ArcStarts')
    def process_break_exits(self, exits):
        """Add arcs due to jumps from `exits` being breaks."""
        for block in self.nearest_blocks():
            if isinstance(block, LoopBlock):
                block.break_exits.update(exits)
                break
            elif isinstance(block, TryBlock) and block.final_start is not None:
                block.break_from.update(exits)
                break

    @contract(exits='ArcStarts')
    def process_continue_exits(self, exits):
        """Add arcs due to jumps from `exits` being continues."""
        for block in self.nearest_blocks():
            if isinstance(block, LoopBlock):
                for xit in exits:
                    self.add_arc(xit.lineno, block.start, xit.cause)
                break
            elif isinstance(block, TryBlock) and block.final_start is not None:
                block.continue_from.update(exits)
                break

    @contract(exits='ArcStarts')
    def process_raise_exits(self, exits):
        """Add arcs due to jumps from `exits` being raises."""
        for block in self.nearest_blocks():
            if isinstance(block, TryBlock):
                if block.handler_start is not None:
                    for xit in exits:
                        self.add_arc(xit.lineno, block.handler_start, xit.cause)
                    break
                elif block.final_start is not None:
                    block.raise_from.update(exits)
                    break
            elif isinstance(block, FunctionBlock):
                for xit in exits:
                    self.add_arc(
                        xit.lineno, -block.start, xit.cause,
                        "didn't except from function '{0}'".format(block.name),
                    )
                break

    @contract(exits='ArcStarts')
    def process_return_exits(self, exits):
        """Add arcs due to jumps from `exits` being returns."""
        for block in self.nearest_blocks():
            if isinstance(block, TryBlock) and block.final_start is not None:
                block.return_from.update(exits)
                break
            elif isinstance(block, FunctionBlock):
                for xit in exits:
                    self.add_arc(
                        xit.lineno, -block.start, xit.cause,
                        "didn't return from function '{0}'".format(block.name),
                    )
                break


    # Handlers: _handle__*
    #
    # Each handler deals with a specific AST node type, dispatched from
    # add_arcs.  Each deals with a particular kind of node type, and returns
    # the set of exits from that node. These functions mirror the Python
    # semantics of each syntactic construct.  See the docstring for add_arcs to
    # understand the concept of exits from a node.

    @contract(returns='ArcStarts')
    def _handle__Break(self, node):
        here = self.line_for_node(node)
        break_start = ArcStart(here, cause="the break on line {lineno} wasn't executed")
        self.process_break_exits([break_start])
        return set()

    @contract(returns='ArcStarts')
    def _handle_decorated(self, node):
        """Add arcs for things that can be decorated (classes and functions)."""
        last = self.line_for_node(node)
        if node.decorator_list:
            for dec_node in node.decorator_list:
                dec_start = self.line_for_node(dec_node)
                if dec_start != last:
                    self.add_arc(last, dec_start)
                    last = dec_start
            # The definition line may have been missed, but we should have it
            # in `self.statements`.  For some constructs, `line_for_node` is
            # not what we'd think of as the first line in the statement, so map
            # it to the first one.
            body_start = self.line_for_node(node.body[0])
            body_start = self.multiline.get(body_start, body_start)
            for lineno in range(last+1, body_start):
                if lineno in self.statements:
                    self.add_arc(last, lineno)
                    last = lineno
        # The body is handled in collect_arcs.
        return set([ArcStart(last)])

    _handle__ClassDef = _handle_decorated

    @contract(returns='ArcStarts')
    def _handle__Continue(self, node):
        here = self.line_for_node(node)
        continue_start = ArcStart(here, cause="the continue on line {lineno} wasn't executed")
        self.process_continue_exits([continue_start])
        return set()

    @contract(returns='ArcStarts')
    def _handle__For(self, node):
        start = self.line_for_node(node.iter)
        self.block_stack.append(LoopBlock(start=start))
        from_start = ArcStart(start, cause="the loop on line {lineno} never started")
        exits = self.add_body_arcs(node.body, from_start=from_start)
        # Any exit from the body will go back to the top of the loop.
        for xit in exits:
            self.add_arc(xit.lineno, start, xit.cause)
        my_block = self.block_stack.pop()
        exits = my_block.break_exits
        from_start = ArcStart(start, cause="the loop on line {lineno} didn't complete")
        if node.orelse:
            else_exits = self.add_body_arcs(node.orelse, from_start=from_start)
            exits |= else_exits
        else:
            # No else clause: exit from the for line.
            exits.add(from_start)
        return exits

    _handle__AsyncFor = _handle__For

    _handle__FunctionDef = _handle_decorated
    _handle__AsyncFunctionDef = _handle_decorated

    @contract(returns='ArcStarts')
    def _handle__If(self, node):
        start = self.line_for_node(node.test)
        from_start = ArcStart(start, cause="the condition on line {lineno} was never true")
        exits = self.add_body_arcs(node.body, from_start=from_start)
        from_start = ArcStart(start, cause="the condition on line {lineno} was never false")
        exits |= self.add_body_arcs(node.orelse, from_start=from_start)
        return exits

    @contract(returns='ArcStarts')
    def _handle__NodeList(self, node):
        start = self.line_for_node(node)
        exits = self.add_body_arcs(node.body, from_start=ArcStart(start))
        return exits

    @contract(returns='ArcStarts')
    def _handle__Raise(self, node):
        here = self.line_for_node(node)
        raise_start = ArcStart(here, cause="the raise on line {lineno} wasn't executed")
        self.process_raise_exits([raise_start])
        # `raise` statement jumps away, no exits from here.
        return set()

    @contract(returns='ArcStarts')
    def _handle__Return(self, node):
        here = self.line_for_node(node)
        return_start = ArcStart(here, cause="the return on line {lineno} wasn't executed")
        self.process_return_exits([return_start])
        # `return` statement jumps away, no exits from here.
        return set()

    @contract(returns='ArcStarts')
    def _handle__Try(self, node):
        if node.handlers:
            handler_start = self.line_for_node(node.handlers[0])
        else:
            handler_start = None

        if node.finalbody:
            final_start = self.line_for_node(node.finalbody[0])
        else:
            final_start = None

        try_block = TryBlock(handler_start, final_start)
        self.block_stack.append(try_block)

        start = self.line_for_node(node)
        exits = self.add_body_arcs(node.body, from_start=ArcStart(start))

        # We're done with the `try` body, so this block no longer handles
        # exceptions. We keep the block so the `finally` clause can pick up
        # flows from the handlers and `else` clause.
        if node.finalbody:
            try_block.handler_start = None
            if node.handlers:
                # If there are `except` clauses, then raises in the try body
                # will already jump to them.  Start this set over for raises in
                # `except` and `else`.
                try_block.raise_from = set([])
        else:
            self.block_stack.pop()

        handler_exits = set()

        if node.handlers:
            last_handler_start = None
            for handler_node in node.handlers:
                handler_start = self.line_for_node(handler_node)
                if last_handler_start is not None:
                    self.add_arc(last_handler_start, handler_start)
                last_handler_start = handler_start
                from_cause = "the exception caught by line {lineno} didn't happen"
                from_start = ArcStart(handler_start, cause=from_cause)
                handler_exits |= self.add_body_arcs(handler_node.body, from_start=from_start)

        if node.orelse:
            exits = self.add_body_arcs(node.orelse, prev_starts=exits)

        exits |= handler_exits

        if node.finalbody:
            self.block_stack.pop()
            final_from = (                  # You can get to the `finally` clause from:
                exits |                         # the exits of the body or `else` clause,
                try_block.break_from |          # or a `break`,
                try_block.continue_from |       # or a `continue`,
                try_block.raise_from |          # or a `raise`,
                try_block.return_from           # or a `return`.
            )

            final_exits = self.add_body_arcs(node.finalbody, prev_starts=final_from)

            if try_block.break_from:
                self.process_break_exits(
                    self._combine_finally_starts(try_block.break_from, final_exits)
                )
            if try_block.continue_from:
                self.process_continue_exits(
                    self._combine_finally_starts(try_block.continue_from, final_exits)
                )
            if try_block.raise_from:
                self.process_raise_exits(
                    self._combine_finally_starts(try_block.raise_from, final_exits)
                )
            if try_block.return_from:
                self.process_return_exits(
                    self._combine_finally_starts(try_block.return_from, final_exits)
                )

            if exits:
                # The finally clause's exits are only exits for the try block
                # as a whole if the try block had some exits to begin with.
                exits = final_exits

        return exits

    @contract(starts='ArcStarts', exits='ArcStarts', returns='ArcStarts')
    def _combine_finally_starts(self, starts, exits):
        """Helper for building the cause of `finally` branches.

        "finally" clauses might not execute their exits, and the causes could
        be due to a failure to execute any of the exits in the try block. So
        we use the causes from `starts` as the causes for `exits`.
        """
        causes = []
        for start in sorted(starts):
            if start.cause is not None:
                causes.append(start.cause.format(lineno=start.lineno))
        cause = " or ".join(causes)
        exits = set(ArcStart(xit.lineno, cause) for xit in exits)
        return exits

    @contract(returns='ArcStarts')
    def _handle__TryExcept(self, node):
        # Python 2.7 uses separate TryExcept and TryFinally nodes. If we get
        # TryExcept, it means there was no finally, so fake it, and treat as
        # a general Try node.
        node.finalbody = []
        return self._handle__Try(node)

    @contract(returns='ArcStarts')
    def _handle__TryFinally(self, node):
        # Python 2.7 uses separate TryExcept and TryFinally nodes. If we get
        # TryFinally, see if there's a TryExcept nested inside. If so, merge
        # them. Otherwise, fake fields to complete a Try node.
        node.handlers = []
        node.orelse = []

        first = node.body[0]
        if first.__class__.__name__ == "TryExcept" and node.lineno == first.lineno:
            assert len(node.body) == 1
            node.body = first.body
            node.handlers = first.handlers
            node.orelse = first.orelse

        return self._handle__Try(node)

    @contract(returns='ArcStarts')
    def _handle__While(self, node):
        constant_test = self.is_constant_expr(node.test)
        start = to_top = self.line_for_node(node.test)
        if constant_test and (env.PY3 or constant_test == "Num"):
            to_top = self.line_for_node(node.body[0])
        self.block_stack.append(LoopBlock(start=to_top))
        from_start = ArcStart(start, cause="the condition on line {lineno} was never true")
        exits = self.add_body_arcs(node.body, from_start=from_start)
        for xit in exits:
            self.add_arc(xit.lineno, to_top, xit.cause)
        exits = set()
        my_block = self.block_stack.pop()
        exits.update(my_block.break_exits)
        from_start = ArcStart(start, cause="the condition on line {lineno} was never false")
        if node.orelse:
            else_exits = self.add_body_arcs(node.orelse, from_start=from_start)
            exits |= else_exits
        else:
            # No `else` clause: you can exit from the start.
            if not constant_test:
                exits.add(from_start)
        return exits

    @contract(returns='ArcStarts')
    def _handle__With(self, node):
        start = self.line_for_node(node)
        exits = self.add_body_arcs(node.body, from_start=ArcStart(start))
        return exits

    _handle__AsyncWith = _handle__With

    def _code_object__Module(self, node):
        start = self.line_for_node(node)
        if node.body:
            exits = self.add_body_arcs(node.body, from_start=ArcStart(-start))
            for xit in exits:
                self.add_arc(xit.lineno, -start, xit.cause, "didn't exit the module")
        else:
            # Empty module.
            self.add_arc(-start, start)
            self.add_arc(start, -start)

    def _code_object__FunctionDef(self, node):
        start = self.line_for_node(node)
        self.block_stack.append(FunctionBlock(start=start, name=node.name))
        exits = self.add_body_arcs(node.body, from_start=ArcStart(-start))
        self.process_return_exits(exits)
        self.block_stack.pop()

    _code_object__AsyncFunctionDef = _code_object__FunctionDef

    def _code_object__ClassDef(self, node):
        start = self.line_for_node(node)
        self.add_arc(-start, start)
        exits = self.add_body_arcs(node.body, from_start=ArcStart(start))
        for xit in exits:
            self.add_arc(
                xit.lineno, -start, xit.cause,
                "didn't exit the body of class '{0}'".format(node.name),
            )

    def _make_oneline_code_method(noun):     # pylint: disable=no-self-argument
        """A function to make methods for online callable _code_object__ methods."""
        def _code_object__oneline_callable(self, node):
            start = self.line_for_node(node)
            self.add_arc(-start, start, None, "didn't run the {0} on line {1}".format(noun, start))
            self.add_arc(
                start, -start, None,
                "didn't finish the {0} on line {1}".format(noun, start),
            )
        return _code_object__oneline_callable

    _code_object__Lambda = _make_oneline_code_method("lambda")
    _code_object__GeneratorExp = _make_oneline_code_method("generator expression")
    _code_object__DictComp = _make_oneline_code_method("dictionary comprehension")
    _code_object__SetComp = _make_oneline_code_method("set comprehension")
    if env.PY3:
        _code_object__ListComp = _make_oneline_code_method("list comprehension")


if AST_DUMP:            # pragma: debugging
    # Code only used when dumping the AST for debugging.

    SKIP_DUMP_FIELDS = ["ctx"]

    def _is_simple_value(value):
        """Is `value` simple enough to be displayed on a single line?"""
        return (
            value in [None, [], (), {}, set()] or
            isinstance(value, (string_class, int, float))
        )

    def ast_dump(node, depth=0):
        """Dump the AST for `node`.

        This recursively walks the AST, printing a readable version.

        """
        indent = " " * depth
        if not isinstance(node, ast.AST):
            print("{0}<{1} {2!r}>".format(indent, node.__class__.__name__, node))
            return

        lineno = getattr(node, "lineno", None)
        if lineno is not None:
            linemark = " @ {0}".format(node.lineno)
        else:
            linemark = ""
        head = "{0}<{1}{2}".format(indent, node.__class__.__name__, linemark)

        named_fields = [
            (name, value)
            for name, value in ast.iter_fields(node)
            if name not in SKIP_DUMP_FIELDS
        ]
        if not named_fields:
            print("{0}>".format(head))
        elif len(named_fields) == 1 and _is_simple_value(named_fields[0][1]):
            field_name, value = named_fields[0]
            print("{0} {1}: {2!r}>".format(head, field_name, value))
        else:
            print(head)
            if 0:
                print("{0}# mro: {1}".format(
                    indent, ", ".join(c.__name__ for c in node.__class__.__mro__[1:]),
                ))
            next_indent = indent + "    "
            for field_name, value in named_fields:
                prefix = "{0}{1}:".format(next_indent, field_name)
                if _is_simple_value(value):
                    print("{0} {1!r}".format(prefix, value))
                elif isinstance(value, list):
                    print("{0} [".format(prefix))
                    for n in value:
                        ast_dump(n, depth + 8)
                    print("{0}]".format(next_indent))
                else:
                    print(prefix)
                    ast_dump(value, depth + 8)

            print("{0}>".format(indent))
