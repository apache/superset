# -*- coding: utf-8 -*-
# Copyright (c) 2016 Moisés López <moylop260@vauxoo.com>
# Copyright (c) 2016 Claudiu Popa <pcmanticore@gmail.com>
# Copyright (c) 2016 Alexander Todorov <atodorov@MrSenko.com>

# Licensed under the GPL: https://www.gnu.org/licenses/old-licenses/gpl-2.0.html
# For details: https://github.com/PyCQA/pylint/blob/master/COPYING

"""Looks for code which can be refactored."""

import collections
import itertools
import tokenize

import astroid
from astroid import decorators
import six

from pylint import interfaces
from pylint import checkers
from pylint import utils as lint_utils
from pylint.checkers import utils


def _all_elements_are_true(gen):
    values = list(gen)
    return values and all(values)


def _if_statement_is_always_returning(if_node):
    def _has_return_node(elems, scope):
        for node in elems:
            if isinstance(node, astroid.If):
                yield _if_statement_is_always_returning(node)
            elif isinstance(node, astroid.Return):
                yield node.scope() is scope

    scope = if_node.scope()
    body_returns = _all_elements_are_true(
        _has_return_node(if_node.body, scope=scope)
    )
    if if_node.orelse:
        orelse_returns = _all_elements_are_true(
            _has_return_node(if_node.orelse, scope=scope)
        )
    else:
        orelse_returns = False

    return body_returns and orelse_returns


class RefactoringChecker(checkers.BaseTokenChecker):
    """Looks for code which can be refactored

    This checker also mixes the astroid and the token approaches
    in order to create knowledge about whether a "else if" node
    is a true "else if" node, or a "elif" node.
    """

    __implements__ = (interfaces.ITokenChecker, interfaces.IAstroidChecker)

    name = 'refactoring'

    msgs = {
        'R1701': ("Consider merging these isinstance calls to isinstance(%s, (%s))",
                  "consider-merging-isinstance",
                  "Used when multiple consecutive isinstance calls can be merged into one."),
        'R1706': ("Consider using ternary (%s if %s else %s)",
                  "consider-using-ternary",
                  "Used when one of known pre-python 2.5 ternary syntax is used."),
        'R1702': ('Too many nested blocks (%s/%s)',
                  'too-many-nested-blocks',
                  'Used when a function or a method has too many nested '
                  'blocks. This makes the code less understandable and '
                  'maintainable.',
                  {'old_names': [('R0101', 'too-many-nested-blocks')]}),
        'R1703': ('The if statement can be replaced with %s',
                  'simplifiable-if-statement',
                  'Used when an if statement can be replaced with '
                  '\'bool(test)\'. ',
                  {'old_names': [('R0102', 'simplifiable-if-statement')]}),
        'R1704': ('Redefining argument with the local name %r',
                  'redefined-argument-from-local',
                  'Used when a local name is redefining an argument, which might '
                  'suggest a potential error. This is taken in account only for '
                  'a handful of name binding operations, such as for iteration, '
                  'with statement assignment and exception handler assignment.'
                 ),
        'R1705': ('Unnecessary "else" after "return"',
                  'no-else-return',
                  'Used in order to highlight an unnecessary block of '
                  'code following an if containing a return statement. '
                  'As such, it will warn when it encounters an else '
                  'following a chain of ifs, all of them containing a '
                  'return statement.'
                 ),
        'R1707': ('Disallow trailing comma tuple',
                  'trailing-comma-tuple',
                  'In Python, a tuple is actually created by the comma symbol, '
                  'not by the parentheses. Unfortunately, one can actually create a '
                  'tuple by misplacing a trailing comma, which can lead to potential '
                  'weird bugs in your code. You should always use parentheses '
                  'explicitly for creating a tuple.',
                  {'minversion': (3, 0)}),
    }
    options = (('max-nested-blocks',
                {'default': 5, 'type': 'int', 'metavar': '<int>',
                 'help': 'Maximum number of nested blocks for function / '
                         'method body'}
               ),)

    priority = 0

    def __init__(self, linter=None):
        checkers.BaseTokenChecker.__init__(self, linter)
        self._init()

    def _init(self):
        self._nested_blocks = []
        self._elifs = []
        self._if_counter = 0
        self._nested_blocks_msg = None

    @decorators.cachedproperty
    def _dummy_rgx(self):
        return lint_utils.get_global_option(
            self, 'dummy-variables-rgx', default=None)

    @staticmethod
    def _is_bool_const(node):
        return (isinstance(node.value, astroid.Const)
                and isinstance(node.value.value, bool))

    def _is_actual_elif(self, node):
        """Check if the given node is an actual elif

        This is a problem we're having with the builtin ast module,
        which splits `elif` branches into a separate if statement.
        Unfortunately we need to know the exact type in certain
        cases.
        """

        if isinstance(node.parent, astroid.If):
            orelse = node.parent.orelse
            # current if node must directly follow a "else"
            if orelse and orelse == [node]:
                if self._elifs[self._if_counter]:
                    return True
        return False

    def _check_simplifiable_if(self, node):
        """Check if the given if node can be simplified.

        The if statement can be reduced to a boolean expression
        in some cases. For instance, if there are two branches
        and both of them return a boolean value that depends on
        the result of the statement's test, then this can be reduced
        to `bool(test)` without losing any functionality.
        """

        if self._is_actual_elif(node):
            # Not interested in if statements with multiple branches.
            return
        if len(node.orelse) != 1 or len(node.body) != 1:
            return

        # Check if both branches can be reduced.
        first_branch = node.body[0]
        else_branch = node.orelse[0]
        if isinstance(first_branch, astroid.Return):
            if not isinstance(else_branch, astroid.Return):
                return
            first_branch_is_bool = self._is_bool_const(first_branch)
            else_branch_is_bool = self._is_bool_const(else_branch)
            reduced_to = "'return bool(test)'"
        elif isinstance(first_branch, astroid.Assign):
            if not isinstance(else_branch, astroid.Assign):
                return
            first_branch_is_bool = self._is_bool_const(first_branch)
            else_branch_is_bool = self._is_bool_const(else_branch)
            reduced_to = "'var = bool(test)'"
        else:
            return

        if not first_branch_is_bool or not else_branch_is_bool:
            return
        if not first_branch.value.value:
            # This is a case that can't be easily simplified and
            # if it can be simplified, it will usually result in a
            # code that's harder to understand and comprehend.
            # Let's take for instance `arg and arg <= 3`. This could theoretically be
            # reduced to `not arg or arg > 3`, but the net result is that now the
            # condition is harder to understand, because it requires understanding of
            # an extra clause:
            #   * first, there is the negation of truthness with `not arg`
            #   * the second clause is `arg > 3`, which occurs when arg has a
            #     a truth value, but it implies that `arg > 3` is equivalent
            #     with `arg and arg > 3`, which means that the user must
            #     think about this assumption when evaluating `arg > 3`.
            #     The original form is easier to grasp.
            return

        self.add_message('simplifiable-if-statement', node=node,
                         args=(reduced_to,))

    def process_tokens(self, tokens):
        # Process tokens and look for 'if' or 'elif'
        for index, token in enumerate(tokens):
            token_string = token[1]
            if token_string == 'elif':
                self._elifs.append(True)
            elif token_string == 'if':
                self._elifs.append(False)
            elif six.PY3 and token.exact_type == tokenize.COMMA:
                self._check_one_element_trailing_comma_tuple(tokens, token, index)

    def _check_one_element_trailing_comma_tuple(self, tokens, token, index):
        left_tokens = itertools.islice(tokens, index + 1, None)
        same_line_remaining_tokens = list(
            other_token for other_token in left_tokens
            if other_token.start[0] == token.start[0]
        )
        is_last_element = all(
            other_token.type in (tokenize.NEWLINE, tokenize.COMMENT)
            for other_token in same_line_remaining_tokens
        )

        if not same_line_remaining_tokens or not is_last_element:
            return

        assign_token = tokens[index-2:index-1]
        if assign_token and '=' in assign_token[0].string:
            if self.linter.is_message_enabled('trailing-comma-tuple'):
                self.add_message('trailing-comma-tuple',
                                 line=token.start[0])

    def leave_module(self, _):
        self._init()

    @utils.check_messages('too-many-nested-blocks')
    def visit_tryexcept(self, node):
        self._check_nested_blocks(node)

    visit_tryfinally = visit_tryexcept
    visit_while = visit_tryexcept

    def _check_redefined_argument_from_local(self, name_node):
        if self._dummy_rgx and self._dummy_rgx.match(name_node.name):
            return
        if not name_node.lineno:
            # Unknown position, maybe it is a manually built AST?
            return

        scope = name_node.scope()
        if not isinstance(scope, astroid.FunctionDef):
            return

        for defined_argument in scope.args.nodes_of_class(astroid.AssignName):
            if defined_argument.name == name_node.name:
                self.add_message('redefined-argument-from-local',
                                 node=name_node,
                                 args=(name_node.name, ))

    @utils.check_messages('redefined-argument-from-local',
                          'too-many-nested-blocks')
    def visit_for(self, node):
        self._check_nested_blocks(node)

        for name in node.target.nodes_of_class(astroid.AssignName):
            self._check_redefined_argument_from_local(name)

    @utils.check_messages('redefined-argument-from-local')
    def visit_excepthandler(self, node):
        if node.name and isinstance(node.name, astroid.AssignName):
            self._check_redefined_argument_from_local(node.name)

    @utils.check_messages('redefined-argument-from-local')
    def visit_with(self, node):
        for _, names in node.items:
            if not names:
                continue
            for name in names.nodes_of_class(astroid.AssignName):
                self._check_redefined_argument_from_local(name)

    def visit_ifexp(self, _):
        self._if_counter += 1

    def visit_comprehension(self, node):
        self._if_counter += len(node.ifs)

    def _check_superfluous_else_return(self, node):
        if not node.orelse:
            # Not interested in if statements without else.
            return

        if _if_statement_is_always_returning(node) and not self._is_actual_elif(node):
            self.add_message('no-else-return', node=node)

    @utils.check_messages('too-many-nested-blocks', 'simplifiable-if-statement',
                          'no-else-return',)
    def visit_if(self, node):
        self._check_simplifiable_if(node)
        self._check_nested_blocks(node)
        self._check_superfluous_else_return(node)
        self._if_counter += 1

    @utils.check_messages('too-many-nested-blocks')
    def leave_functiondef(self, _):
        # check left-over nested blocks stack
        self._emit_nested_blocks_message_if_needed(self._nested_blocks)
        # new scope = reinitialize the stack of nested blocks
        self._nested_blocks = []

    def _check_nested_blocks(self, node):
        """Update and check the number of nested blocks
        """
        # only check block levels inside functions or methods
        if not isinstance(node.scope(), astroid.FunctionDef):
            return
        # messages are triggered on leaving the nested block. Here we save the
        # stack in case the current node isn't nested in the previous one
        nested_blocks = self._nested_blocks[:]
        if node.parent == node.scope():
            self._nested_blocks = [node]
        else:
            # go through ancestors from the most nested to the less
            for ancestor_node in reversed(self._nested_blocks):
                if ancestor_node == node.parent:
                    break
                self._nested_blocks.pop()
            # if the node is a elif, this should not be another nesting level
            if isinstance(node, astroid.If) and self._elifs[self._if_counter]:
                if self._nested_blocks:
                    self._nested_blocks.pop()
            self._nested_blocks.append(node)

        # send message only once per group of nested blocks
        if len(nested_blocks) > len(self._nested_blocks):
            self._emit_nested_blocks_message_if_needed(nested_blocks)

    def _emit_nested_blocks_message_if_needed(self, nested_blocks):
        if len(nested_blocks) > self.config.max_nested_blocks:
            self.add_message('too-many-nested-blocks', node=nested_blocks[0],
                             args=(len(nested_blocks), self.config.max_nested_blocks))

    @staticmethod
    def _duplicated_isinstance_types(node):
        """Get the duplicated types from the underlying isinstance calls.

        :param astroid.BoolOp node: Node which should contain a bunch of isinstance calls.
        :returns: Dictionary of the comparison objects from the isinstance calls,
                  to duplicate values from consecutive calls.
        :rtype: dict
        """
        duplicated_objects = set()
        all_types = collections.defaultdict(set)

        for call in node.values:
            if not isinstance(call, astroid.Call) or len(call.args) != 2:
                continue

            inferred = utils.safe_infer(call.func)
            if not inferred or not utils.is_builtin_object(inferred):
                continue

            if inferred.name != 'isinstance':
                continue

            isinstance_object = call.args[0].as_string()
            isinstance_types = call.args[1]

            if isinstance_object in all_types:
                duplicated_objects.add(isinstance_object)

            if isinstance(isinstance_types, astroid.Tuple):
                elems = [class_type.as_string() for class_type in isinstance_types.itered()]
            else:
                elems = [isinstance_types.as_string()]
            all_types[isinstance_object].update(elems)

        # Remove all keys which not duplicated
        return {key: value for key, value in all_types.items()
                if key in duplicated_objects}

    @utils.check_messages('consider-merging-isinstance')
    def visit_boolop(self, node):
        '''Check isinstance calls which can be merged together.'''
        if node.op != 'or':
            return

        first_args = self._duplicated_isinstance_types(node)
        for duplicated_name, class_names in first_args.items():
            names = sorted(name for name in class_names)
            self.add_message('consider-merging-isinstance',
                             node=node,
                             args=(duplicated_name, ', '.join(names)))

    @utils.check_messages('consider-using-ternary')
    def visit_assign(self, node):
        if self._is_and_or_ternary(node.value):
            cond, truth_value, false_value = self._and_or_ternary_arguments(node.value)
        elif self._is_seq_based_ternary(node.value):
            cond, truth_value, false_value = self._seq_based_ternary_params(node.value)
        else:
            return

        self.add_message(
            'consider-using-ternary', node=node,
            args=(truth_value.as_string(),
                  cond.as_string(),
                  false_value.as_string()),)

    visit_return = visit_assign

    @staticmethod
    def _is_and_or_ternary(node):
        """
        Returns true if node is 'condition and true_value else false_value' form.

        All of: condition, true_value and false_value should not be a complex boolean expression
        """
        return (isinstance(node, astroid.BoolOp)
                and node.op == 'or' and len(node.values) == 2
                and isinstance(node.values[0], astroid.BoolOp)
                and not isinstance(node.values[1], astroid.BoolOp)
                and node.values[0].op == 'and'
                and not isinstance(node.values[0].values[1], astroid.BoolOp)
                and len(node.values[0].values) == 2)

    @staticmethod
    def _and_or_ternary_arguments(node):
        false_value = node.values[1]
        condition, true_value = node.values[0].values
        return condition, true_value, false_value

    @staticmethod
    def _is_seq_based_ternary(node):
        """Returns true if node is '[false_value,true_value][condition]' form"""
        return (isinstance(node, astroid.Subscript)
                and isinstance(node.value, (astroid.Tuple, astroid.List))
                and len(node.value.elts) == 2 and isinstance(node.slice, astroid.Index))

    @staticmethod
    def _seq_based_ternary_params(node):
        false_value, true_value = node.value.elts
        condition = node.slice.value
        return condition, true_value, false_value


class RecommandationChecker(checkers.BaseChecker):
    __implements__ = (interfaces.IAstroidChecker,)
    name = 'refactoring'
    msgs = {'C0200': ('Consider using enumerate instead of iterating with range and len',
                      'consider-using-enumerate',
                      'Emitted when code that iterates with range and len is '
                      'encountered. Such code can be simplified by using the '
                      'enumerate builtin.'),
            'C0201': ('Consider iterating the dictionary directly instead of calling .keys()',
                      'consider-iterating-dictionary',
                      'Emitted when the keys of a dictionary are iterated through the .keys() '
                      'method. It is enough to just iterate through the dictionary itself, as '
                      'in "for key in dictionary".'),
           }

    @staticmethod
    def _is_builtin(node, function):
        inferred = utils.safe_infer(node)
        if not inferred:
            return False
        return utils.is_builtin_object(inferred) and inferred.name == function

    @utils.check_messages('consider-iterating-dictionary')
    def visit_call(self, node):
        inferred = utils.safe_infer(node.func)
        if not inferred:
            return

        if not isinstance(inferred, astroid.BoundMethod):
            return
        if not isinstance(inferred.bound, astroid.Dict) or inferred.name != 'keys':
            return

        if isinstance(node.parent, (astroid.For, astroid.Comprehension)):
            self.add_message('consider-iterating-dictionary', node=node)

    @utils.check_messages('consider-using-enumerate')
    def visit_for(self, node):
        """Emit a convention whenever range and len are used for indexing."""
        # Verify that we have a `range(len(...))` call and that the object
        # which is iterated is used as a subscript in the body of the for.

        # Is it a proper range call?
        if not isinstance(node.iter, astroid.Call):
            return
        if not self._is_builtin(node.iter.func, 'range'):
            return
        if len(node.iter.args) != 1:
            return

        # Is it a proper len call?
        if not isinstance(node.iter.args[0], astroid.Call):
            return
        second_func = node.iter.args[0].func
        if not self._is_builtin(second_func, 'len'):
            return
        len_args = node.iter.args[0].args
        if not len_args or len(len_args) != 1:
            return
        iterating_object = len_args[0]
        if not isinstance(iterating_object, astroid.Name):
            return

        # Verify that the body of the for loop uses a subscript
        # with the object that was iterated. This uses some heuristics
        # in order to make sure that the same object is used in the
        # for body.
        for child in node.body:
            for subscript in child.nodes_of_class(astroid.Subscript):
                if not isinstance(subscript.value, astroid.Name):
                    continue
                if not isinstance(subscript.slice, astroid.Index):
                    continue
                if not isinstance(subscript.slice.value, astroid.Name):
                    continue
                if subscript.slice.value.name != node.target.name:
                    continue
                if iterating_object.name != subscript.value.name:
                    continue
                if subscript.value.scope() != node.scope():
                    # Ignore this subscript if it's not in the same
                    # scope. This means that in the body of the for
                    # loop, another scope was created, where the same
                    # name for the iterating object was used.
                    continue
                self.add_message('consider-using-enumerate', node=node)
                return


class NotChecker(checkers.BaseChecker):
    """checks for too many not in comparison expressions

    - "not not" should trigger a warning
    - "not" followed by a comparison should trigger a warning
    """
    __implements__ = (interfaces.IAstroidChecker,)
    msgs = {'C0113': ('Consider changing "%s" to "%s"',
                      'unneeded-not',
                      'Used when a boolean expression contains an unneeded '
                      'negation.'),
           }
    name = 'basic'
    reverse_op = {'<': '>=', '<=': '>', '>': '<=', '>=': '<', '==': '!=',
                  '!=': '==', 'in': 'not in', 'is': 'is not'}
    # sets are not ordered, so for example "not set(LEFT_VALS) <= set(RIGHT_VALS)" is
    # not equivalent to "set(LEFT_VALS) > set(RIGHT_VALS)"
    skipped_nodes = (astroid.Set,)
    # 'builtins' py3, '__builtin__' py2
    skipped_classnames = ['%s.%s' % (six.moves.builtins.__name__, qname)
                          for qname in ('set', 'frozenset')]

    @utils.check_messages('unneeded-not')
    def visit_unaryop(self, node):
        if node.op != 'not':
            return
        operand = node.operand

        if isinstance(operand, astroid.UnaryOp) and operand.op == 'not':
            self.add_message('unneeded-not', node=node,
                             args=(node.as_string(),
                                   operand.operand.as_string()))
        elif isinstance(operand, astroid.Compare):
            left = operand.left
            # ignore multiple comparisons
            if len(operand.ops) > 1:
                return
            operator, right = operand.ops[0]
            if operator not in self.reverse_op:
                return
            # Ignore __ne__ as function of __eq__
            frame = node.frame()
            if frame.name == '__ne__' and operator == '==':
                return
            for _type in (utils.node_type(left), utils.node_type(right)):
                if not _type:
                    return
                if isinstance(_type, self.skipped_nodes):
                    return
                if (isinstance(_type, astroid.Instance) and
                        _type.qname() in self.skipped_classnames):
                    return
            suggestion = '%s %s %s' % (left.as_string(),
                                       self.reverse_op[operator],
                                       right.as_string())
            self.add_message('unneeded-not', node=node,
                             args=(node.as_string(), suggestion))


def _is_len_call(node):
    """Checks if node is len(SOMETHING)."""
    return (isinstance(node, astroid.Call) and isinstance(node.func, astroid.Name) and
            node.func.name == 'len')

def _is_constant_zero(node):
    return isinstance(node, astroid.Const) and node.value == 0

def _node_is_test_condition(node):
    """ Checks if node is an if, while, assert or if expression statement."""
    return isinstance(node, (astroid.If, astroid.While, astroid.Assert, astroid.IfExp))


class LenChecker(checkers.BaseChecker):
    """Checks for incorrect usage of len() inside conditions.
    Pep8 states:
    For sequences, (strings, lists, tuples), use the fact that empty sequences are false.

        Yes: if not seq:
             if seq:

        No: if len(seq):
            if not len(seq):

    Problems detected:
    * if len(sequence):
    * if not len(sequence):
    * if len(sequence) == 0:
    * if len(sequence) != 0:
    * if len(sequence) > 0:
    """

    __implements__ = (interfaces.IAstroidChecker,)

    # configuration section name
    name = 'len'
    msgs = {'C1801': ('Do not use `len(SEQUENCE)` as condition value',
                      'len-as-condition',
                      'Used when Pylint detects incorrect use of len(sequence) inside '
                      'conditions.'),
           }

    priority = -2
    options = ()

    @utils.check_messages('len-as-condition')
    def visit_call(self, node):
        # a len(S) call is used inside a test condition
        # could be if, while, assert or if expression statement
        # e.g. `if len(S):`
        if _is_len_call(node):
            # the len() call could also be nested together with other
            # boolean operations, e.g. `if z or len(x):`
            parent = node.parent
            while isinstance(parent, astroid.BoolOp):
                parent = parent.parent

            # we're finally out of any nested boolean operations so check if
            # this len() call is part of a test condition
            if not _node_is_test_condition(parent):
                return
            if not (node is parent.test or parent.test.parent_of(node)):
                return
            self.add_message('len-as-condition', node=node)

    @utils.check_messages('len-as-condition')
    def visit_unaryop(self, node):
        """`not len(S)` must become `not S` regardless if the parent block
        is a test condition or something else (boolean expression)
        e.g. `if not len(S):`"""
        if isinstance(node, astroid.UnaryOp) and node.op == 'not' and _is_len_call(node.operand):
            self.add_message('len-as-condition', node=node)

    @utils.check_messages('len-as-condition')
    def visit_compare(self, node):
        # compare nodes are trickier because the len(S) expression
        # may be somewhere in the middle of the node

        # note: astroid.Compare has the left most operand in node.left
        # while the rest are a list of tuples in node.ops
        # the format of the tuple is ('compare operator sign', node)
        # here we squash everything into `ops` to make it easier for processing later
        ops = [('', node.left)]
        ops.extend(node.ops)
        ops = list(itertools.chain(*ops))

        for ops_idx in range(len(ops) - 2):
            op_1 = ops[ops_idx]
            op_2 = ops[ops_idx + 1]
            op_3 = ops[ops_idx + 2]
            error_detected = False

            # 0 ?? len()
            if _is_constant_zero(op_1) and op_2 in ['==', '!=', '<'] and _is_len_call(op_3):
                error_detected = True
            # len() ?? 0
            elif _is_len_call(op_1) and op_2 in ['==', '!=', '>'] and _is_constant_zero(op_3):
                error_detected = True

            if error_detected:
                parent = node.parent
                # traverse the AST to figure out if this comparison was part of
                # a test condition
                while parent and not _node_is_test_condition(parent):
                    parent = parent.parent

                # report only if this len() comparison is part of a test condition
                # for example: return len() > 0 should not report anything
                if _node_is_test_condition(parent):
                    self.add_message('len-as-condition', node=node)


def register(linter):
    """Required method to auto register this checker."""
    linter.register_checker(RefactoringChecker(linter))
    linter.register_checker(NotChecker(linter))
    linter.register_checker(RecommandationChecker(linter))
    linter.register_checker(LenChecker(linter))
