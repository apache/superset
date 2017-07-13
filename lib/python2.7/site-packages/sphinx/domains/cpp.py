# -*- coding: utf-8 -*-
"""
    sphinx.domains.cpp
    ~~~~~~~~~~~~~~~~~~

    The C++ language domain.

    :copyright: Copyright 2007-2017 by the Sphinx team, see AUTHORS.
    :license: BSD, see LICENSE for details.
"""

import re
from copy import deepcopy

from six import iteritems, text_type

from docutils import nodes
from docutils.parsers.rst import Directive, directives

from sphinx import addnodes
from sphinx.roles import XRefRole
from sphinx.locale import l_, _
from sphinx.domains import Domain, ObjType
from sphinx.directives import ObjectDescription
from sphinx.util import logging
from sphinx.util.nodes import make_refnode
from sphinx.util.pycompat import UnicodeMixin
from sphinx.util.docfields import Field, GroupedField

if False:
    # For type annotation
    from typing import Any, Callable, Dict, Iterator, List, Match, Pattern, Tuple, Union  # NOQA
    from sphinx.application import Sphinx  # NOQA
    from sphinx.builders import Builder  # NOQA
    from sphinx.config import Config  # NOQA
    from sphinx.environment import BuildEnvironment  # NOQA

logger = logging.getLogger(__name__)

"""
    Important note on ids
    ----------------------------------------------------------------------------

    Multiple id generation schemes are used due to backwards compatibility.
    - v1: 1.2.3 <= version < 1.3
          The style used before the rewrite.
          It is not the actual old code, but a replication of the behaviour.
    - v2: 1.3 <= version < now
          Standardised mangling scheme from
          http://mentorembedded.github.io/cxx-abi/abi.html#mangling
          though not completely implemented.
    All versions are generated and attached to elements. The newest is used for
    the index. All of the versions should work as permalinks.


    Signature Nodes and Tagnames
    ----------------------------------------------------------------------------

    Each signature is in a desc_signature node, where all children are
    desc_signature_line nodes. Each of these lines will have the attribute
    'sphinx_cpp_tagname' set to one of the following (prioritized):
    - 'declarator', if the line contains the name of the declared object.
    - 'templateParams', if the line starts a template parameter list,
    - 'templateParams', if the line has template parameters
      Note: such lines might get a new tag in the future.
    - 'templateIntroduction, if the line is on the form 'conceptName{...}'
    No other desc_signature nodes should exist (so far).


    Grammar
    ----------------------------------------------------------------------------

    See http://www.nongnu.org/hcb/ for the grammar,
    and https://github.com/cplusplus/draft/blob/master/source/grammar.tex,
    and https://github.com/cplusplus/concepts-ts
    for the newest grammar.

    common grammar things:
        template-declaration ->
            "template" "<" template-parameter-list ">" declaration
        template-parameter-list ->
              template-parameter
            | template-parameter-list "," template-parameter
        template-parameter ->
              type-parameter
            | parameter-declaration # i.e., same as a function argument

        type-parameter ->
              "class"    "..."[opt] identifier[opt]
            | "class"               identifier[opt] "=" type-id
            | "typename" "..."[opt] identifier[opt]
            | "typename"            identifier[opt] "=" type-id
            | "template" "<" template-parameter-list ">"
                "class"  "..."[opt] identifier[opt]
            | "template" "<" template-parameter-list ">"
                "class"             identifier[opt] "=" id-expression
            # also, from C++17 we can have "typname" in template templates
        templateDeclPrefix ->
            "template" "<" template-parameter-list ">"

        simple-declaration ->
            attribute-specifier-seq[opt] decl-specifier-seq[opt]
                init-declarator-list[opt] ;
        # Drop the semi-colon. For now: drop the attributes (TODO).
        # Use at most 1 init-declarator.
        -> decl-specifier-seq init-declarator
        -> decl-specifier-seq declarator initializer

        decl-specifier ->
              storage-class-specifier ->
                 (  "static" (only for member_object and function_object)
                  | "extern" (only for member_object and function_object)
                  | "register"
                 )
                 thread_local[opt] (only for member_object)
                                   (it can also appear before the others)

            | type-specifier -> trailing-type-specifier
            | function-specifier -> "inline" | "virtual" | "explicit" (only
              for function_object)
            | "friend" (only for function_object)
            | "constexpr" (only for member_object and function_object)
        trailing-type-specifier ->
              simple-type-specifier
            | elaborated-type-specifier
            | typename-specifier
            | cv-qualifier -> "const" | "volatile"
        stricter grammar for decl-specifier-seq (with everything, each object
        uses a subset):
            visibility storage-class-specifier function-specifier "friend"
            "constexpr" "volatile" "const" trailing-type-specifier
            # where trailing-type-specifier can no be cv-qualifier
        # Inside e.g., template paramters a strict subset is used
        # (see type-specifier-seq)
        trailing-type-specifier ->
              simple-type-specifier ->
                ::[opt] nested-name-specifier[opt] type-name
              | ::[opt] nested-name-specifier "template" simple-template-id
              | "char" | "bool" | ect.
              | decltype-specifier
            | elaborated-type-specifier ->
                class-key attribute-specifier-seq[opt] ::[opt]
                nested-name-specifier[opt] identifier
              | class-key ::[opt] nested-name-specifier[opt] template[opt]
                simple-template-id
              | "enum" ::[opt] nested-name-specifier[opt] identifier
            | typename-specifier ->
                "typename" ::[opt] nested-name-specifier identifier
              | "typename" ::[opt] nested-name-specifier template[opt]
                simple-template-id
        class-key -> "class" | "struct" | "union"
        type-name ->* identifier | simple-template-id
        # ignoring attributes and decltype, and then some left-factoring
        trailing-type-specifier ->
            rest-of-trailing
            ("class" | "struct" | "union" | "typename") rest-of-trailing
            build-in -> "char" | "bool" | ect.
            decltype-specifier
        rest-of-trailing -> (with some simplification)
            "::"[opt] list-of-elements-separated-by-::
        element ->
            "template"[opt] identifier ("<" template-argument-list ">")[opt]
        template-argument-list ->
              template-argument "..."[opt]
            | template-argument-list "," template-argument "..."[opt]
        template-argument ->
              constant-expression
            | type-specifier-seq abstract-declarator
            | id-expression


        declarator ->
              ptr-declarator
            | noptr-declarator parameters-and-qualifiers trailing-return-type
              (TODO: for now we don't support trailing-eturn-type)
        ptr-declarator ->
              noptr-declarator
            | ptr-operator ptr-declarator
        noptr-declarator ->
              declarator-id attribute-specifier-seq[opt] ->
                    "..."[opt] id-expression
                  | rest-of-trailing
            | noptr-declarator parameters-and-qualifiers
            | noptr-declarator "[" constant-expression[opt] "]"
              attribute-specifier-seq[opt]
            | "(" ptr-declarator ")"
        ptr-operator ->
              "*"  attribute-specifier-seq[opt] cv-qualifier-seq[opt]
            | "&   attribute-specifier-seq[opt]
            | "&&" attribute-specifier-seq[opt]
            | "::"[opt] nested-name-specifier "*" attribute-specifier-seq[opt]
                cv-qualifier-seq[opt]
        # function_object must use a parameters-and-qualifiers, the others may
        # use it (e.g., function poitners)
        parameters-and-qualifiers ->
            "(" parameter-clause ")" attribute-specifier-seq[opt]
            cv-qualifier-seq[opt] ref-qualifier[opt]
            exception-specification[opt]
        ref-qualifier -> "&" | "&&"
        exception-specification ->
            "noexcept" ("(" constant-expression ")")[opt]
            "throw" ("(" type-id-list ")")[opt]
        # TODO: we don't implement attributes
        # member functions can have initializers, but we fold them into here
        memberFunctionInit -> "=" "0"
        # (note: only "0" is allowed as the value, according to the standard,
        # right?)

        enum-head ->
            enum-key attribute-specifier-seq[opt] nested-name-specifier[opt]
                identifier enum-base[opt]
        enum-key -> "enum" | "enum struct" | "enum class"
        enum-base ->
            ":" type
        enumerator-definition ->
              identifier
            | identifier "=" constant-expression

    We additionally add the possibility for specifying the visibility as the
    first thing.

    concept_object:
        goal:
            just a declaration of the name (for now)
            either a variable concept or function concept

        grammar: only a single template parameter list, and the nested name
            may not have any template argument lists

            "template" "<" template-parameter-list ">"
            nested-name-specifier "()"[opt]

    type_object:
        goal:
            either a single type (e.g., "MyClass:Something_T" or a typedef-like
            thing (e.g. "Something Something_T" or "int I_arr[]"
        grammar, single type: based on a type in a function parameter, but
        without a name:
               parameter-declaration
            -> attribute-specifier-seq[opt] decl-specifier-seq
               abstract-declarator[opt]
            # Drop the attributes
            -> decl-specifier-seq abstract-declarator[opt]
        grammar, typedef-like: no initilizer
            decl-specifier-seq declarator
        Can start with a templateDeclPrefix.

    member_object:
        goal: as a type_object which must have a declarator, and optionally
        with a initializer
        grammar:
            decl-specifier-seq declarator initializer
        Can start with a templateDeclPrefix.

    function_object:
        goal: a function declaration, TODO: what about templates? for now: skip
        grammar: no initializer
           decl-specifier-seq declarator
        Can start with a templateDeclPrefix.

    class_object:
        goal: a class declaration, but with specification of a base class
        grammar:
              nested-name "final"[opt] (":" base-specifier-list)[opt]
            base-specifier-list ->
              base-specifier "..."[opt]
            | base-specifier-list, base-specifier "..."[opt]
            base-specifier ->
              base-type-specifier
            | "virtual" access-spe"cifier[opt]    base-type-specifier
            | access-specifier[opt] "virtual"[opt] base-type-specifier
        Can start with a templateDeclPrefix.

    enum_object:
        goal: an unscoped enum or a scoped enum, optionally with the underlying
              type specified
        grammar:
            ("class" | "struct")[opt] visibility[opt] nested-name (":" type)[opt]
    enumerator_object:
        goal: an element in a scoped or unscoped enum. The name should be
              injected according to the scopedness.
        grammar:
            nested-name ("=" constant-expression)

    namespace_object:
        goal: a directive to put all following declarations in a specific scope
        grammar:
            nested-name
"""

_identifier_re = re.compile(r'(~?\b[a-zA-Z_][a-zA-Z0-9_]*)\b')
_whitespace_re = re.compile(r'\s+(?u)')
_string_re = re.compile(r"[LuU8]?('([^'\\]*(?:\\.[^'\\]*)*)'"
                        r'|"([^"\\]*(?:\\.[^"\\]*)*)")', re.S)
_visibility_re = re.compile(r'\b(public|private|protected)\b')
_operator_re = re.compile(r'''(?x)
        \[\s*\]
    |   \(\s*\)
    |   \+\+ | --
    |   ->\*? | \,
    |   (<<|>>)=? | && | \|\|
    |   [!<>=/*%+|&^~-]=?
''')
# see http://en.cppreference.com/w/cpp/keyword
_keywords = [
    'alignas', 'alignof', 'and', 'and_eq', 'asm', 'auto', 'bitand', 'bitor',
    'bool', 'break', 'case', 'catch', 'char', 'char16_t', 'char32_t', 'class',
    'compl', 'concept', 'const', 'constexpr', 'const_cast', 'continue',
    'decltype', 'default', 'delete', 'do', 'double', 'dynamic_cast', 'else',
    'enum', 'explicit', 'export', 'extern', 'false', 'float', 'for', 'friend',
    'goto', 'if', 'inline', 'int', 'long', 'mutable', 'namespace', 'new',
    'noexcept', 'not', 'not_eq', 'nullptr', 'operator', 'or', 'or_eq',
    'private', 'protected', 'public', 'register', 'reinterpret_cast',
    'requires', 'return', 'short', 'signed', 'sizeof', 'static',
    'static_assert', 'static_cast', 'struct', 'switch', 'template', 'this',
    'thread_local', 'throw', 'true', 'try', 'typedef', 'typeid', 'typename',
    'union', 'unsigned', 'using', 'virtual', 'void', 'volatile', 'wchar_t',
    'while', 'xor', 'xor_eq'
]

# ------------------------------------------------------------------------------
# Id v1 constants
# ------------------------------------------------------------------------------

_id_fundamental_v1 = {
    'char': 'c',
    'signed char': 'c',
    'unsigned char': 'C',
    'int': 'i',
    'signed int': 'i',
    'unsigned int': 'U',
    'long': 'l',
    'signed long': 'l',
    'unsigned long': 'L',
    'bool': 'b'
}  # type: Dict[unicode, unicode]
_id_shorthands_v1 = {
    'std::string': 'ss',
    'std::ostream': 'os',
    'std::istream': 'is',
    'std::iostream': 'ios',
    'std::vector': 'v',
    'std::map': 'm'
}  # type: Dict[unicode, unicode]
_id_operator_v1 = {
    'new': 'new-operator',
    'new[]': 'new-array-operator',
    'delete': 'delete-operator',
    'delete[]': 'delete-array-operator',
    # the arguments will make the difference between unary and binary
    # '+(unary)' : 'ps',
    # '-(unary)' : 'ng',
    # '&(unary)' : 'ad',
    # '*(unary)' : 'de',
    '~': 'inv-operator',
    '+': 'add-operator',
    '-': 'sub-operator',
    '*': 'mul-operator',
    '/': 'div-operator',
    '%': 'mod-operator',
    '&': 'and-operator',
    '|': 'or-operator',
    '^': 'xor-operator',
    '=': 'assign-operator',
    '+=': 'add-assign-operator',
    '-=': 'sub-assign-operator',
    '*=': 'mul-assign-operator',
    '/=': 'div-assign-operator',
    '%=': 'mod-assign-operator',
    '&=': 'and-assign-operator',
    '|=': 'or-assign-operator',
    '^=': 'xor-assign-operator',
    '<<': 'lshift-operator',
    '>>': 'rshift-operator',
    '<<=': 'lshift-assign-operator',
    '>>=': 'rshift-assign-operator',
    '==': 'eq-operator',
    '!=': 'neq-operator',
    '<': 'lt-operator',
    '>': 'gt-operator',
    '<=': 'lte-operator',
    '>=': 'gte-operator',
    '!': 'not-operator',
    '&&': 'sand-operator',
    '||': 'sor-operator',
    '++': 'inc-operator',
    '--': 'dec-operator',
    ',': 'comma-operator',
    '->*': 'pointer-by-pointer-operator',
    '->': 'pointer-operator',
    '()': 'call-operator',
    '[]': 'subscript-operator'
}  # type: Dict[unicode, unicode]

# ------------------------------------------------------------------------------
# Id v2 constants
# ------------------------------------------------------------------------------

_id_prefix_v2 = '_CPPv2'
_id_fundamental_v2 = {
    # not all of these are actually parsed as fundamental types, TODO: do that
    'void': 'v',
    'bool': 'b',
    'char': 'c',
    'signed char': 'a',
    'unsigned char': 'h',
    'wchar_t': 'w',
    'char32_t': 'Di',
    'char16_t': 'Ds',
    'short': 's',
    'short int': 's',
    'signed short': 's',
    'signed short int': 's',
    'unsigned short': 't',
    'unsigned short int': 't',
    'int': 'i',
    'signed': 'i',
    'signed int': 'i',
    'unsigned': 'j',
    'unsigned int': 'j',
    'long': 'l',
    'long int': 'l',
    'signed long': 'l',
    'signed long int': 'l',
    'unsigned long': 'm',
    'unsigned long int': 'm',
    'long long': 'x',
    'long long int': 'x',
    'signed long long': 'x',
    'signed long long int': 'x',
    'unsigned long long': 'y',
    'unsigned long long int': 'y',
    'float': 'f',
    'double': 'd',
    'long double': 'e',
    'auto': 'Da',
    'decltype(auto)': 'Dc',
    'std::nullptr_t': 'Dn'
}  # type: Dict[unicode, unicode]
_id_operator_v2 = {
    'new': 'nw',
    'new[]': 'na',
    'delete': 'dl',
    'delete[]': 'da',
    # the arguments will make the difference between unary and binary
    # '+(unary)' : 'ps',
    # '-(unary)' : 'ng',
    # '&(unary)' : 'ad',
    # '*(unary)' : 'de',
    '~': 'co',
    '+': 'pl',
    '-': 'mi',
    '*': 'ml',
    '/': 'dv',
    '%': 'rm',
    '&': 'an',
    '|': 'or',
    '^': 'eo',
    '=': 'aS',
    '+=': 'pL',
    '-=': 'mI',
    '*=': 'mL',
    '/=': 'dV',
    '%=': 'rM',
    '&=': 'aN',
    '|=': 'oR',
    '^=': 'eO',
    '<<': 'ls',
    '>>': 'rs',
    '<<=': 'lS',
    '>>=': 'rS',
    '==': 'eq',
    '!=': 'ne',
    '<': 'lt',
    '>': 'gt',
    '<=': 'le',
    '>=': 'ge',
    '!': 'nt',
    '&&': 'aa',
    '||': 'oo',
    '++': 'pp',
    '--': 'mm',
    ',': 'cm',
    '->*': 'pm',
    '->': 'pt',
    '()': 'cl',
    '[]': 'ix'
}  # type: Dict[unicode, unicode]


class NoOldIdError(UnicodeMixin, Exception):
    # Used to avoid implementing unneeded id generation for old id schmes.
    def __init__(self, description=""):
        # type: (unicode) -> None
        self.description = description

    def __unicode__(self):
        # type: () -> unicode
        return self.description


class DefinitionError(UnicodeMixin, Exception):
    def __init__(self, description):
        # type: (unicode) -> None
        self.description = description

    def __unicode__(self):
        # type: () -> unicode
        return self.description


class _DuplicateSymbolError(UnicodeMixin, Exception):
    def __init__(self, symbol, candSymbol):
        # type: (Symbol, Symbol) -> None
        assert symbol
        assert candSymbol
        self.symbol = symbol
        self.candSymbol = candSymbol

    def __unicode__(self):
        # type: () -> unicode
        return "Internal C++ duplicate symbol error:\n%s" % self.symbol.dump(0)


class ASTBase(UnicodeMixin):
    def __eq__(self, other):
        # type: (Any) -> bool
        if type(self) is not type(other):
            return False
        try:
            for key, value in iteritems(self.__dict__):  # type: ignore
                if value != getattr(other, key):
                    return False
        except AttributeError:
            return False
        return True

    def __ne__(self, other):
        # type: (Any) -> bool
        return not self.__eq__(other)

    __hash__ = None  # type: Callable[[], int]

    def clone(self):
        # type: () -> ASTBase
        """Clone a definition expression node."""
        return deepcopy(self)

    def get_id_v1(self):
        # type: () -> unicode
        """Return the v1 id for the node."""
        raise NotImplementedError(repr(self))

    def get_id_v2(self):
        # type: () -> unicode
        """Return the v2 id for the node."""
        raise NotImplementedError(repr(self))

    def get_name(self):
        # type: () -> unicode
        """Return the name.

        Returns either `None` or a node with a name you might call
        :meth:`split_owner` on.
        """
        raise NotImplementedError(repr(self))

    def prefix_nested_name(self, prefix):
        # type: (unicode) -> unicode
        """Prefix a name node (a node returned by :meth:`get_name`)."""
        raise NotImplementedError(repr(self))

    def __unicode__(self):
        # type: () -> unicode
        raise NotImplementedError(repr(self))

    def __repr__(self):
        return '<%s %s>' % (self.__class__.__name__, self)


def _verify_description_mode(mode):
    # type: (unicode) -> None
    if mode not in ('lastIsName', 'noneIsName', 'markType', 'param'):
        raise Exception("Description mode '%s' is invalid." % mode)


class ASTCPPAttribute(ASTBase):
    def __init__(self, arg):
        # type: (unicode) -> None
        self.arg = arg

    def __unicode__(self):
        # type: () -> unicode
        return "[[" + self.arg + "]]"

    def describe_signature(self, signode):
        # type: (addnodes.desc_signature) -> None
        txt = text_type(self)
        signode.append(nodes.Text(txt, txt))


class ASTGnuAttribute(ASTBase):
    def __init__(self, name, args):
        # type: (unicode, Any) -> None
        self.name = name
        self.args = args

    def __unicode__(self):
        # type: () -> unicode
        res = [self.name]  # type: List[unicode]
        if self.args:
            res.append('(')
            res.append(text_type(self.args))
            res.append(')')
        return ''.join(res)


class ASTGnuAttributeList(ASTBase):
    def __init__(self, attrs):
        # type: (List[Any]) -> None
        self.attrs = attrs

    def __unicode__(self):
        # type: () -> unicode
        res = ['__attribute__((']  # type: List[unicode]
        first = True
        for attr in self.attrs:
            if not first:
                res.append(', ')
            first = False
            res.append(text_type(attr))
        res.append('))')
        return ''.join(res)

    def describe_signature(self, signode):
        # type: (addnodes.desc_signature) -> None
        txt = text_type(self)
        signode.append(nodes.Text(txt, txt))


class ASTIdAttribute(ASTBase):
    """For simple attributes defined by the user."""

    def __init__(self, id):
        # type: (unicode) -> None
        self.id = id

    def __unicode__(self):
        # type: () -> unicode
        return self.id

    def describe_signature(self, signode):
        # type: (addnodes.desc_signature) -> None
        signode.append(nodes.Text(self.id, self.id))


class ASTParenAttribute(ASTBase):
    """For paren attributes defined by the user."""

    def __init__(self, id, arg):
        # type: (unicode, unicode) -> None
        self.id = id
        self.arg = arg

    def __unicode__(self):
        # type: () -> unicode
        return self.id + '(' + self.arg + ')'

    def describe_signature(self, signode):
        # type: (addnodes.desc_signature) -> None
        txt = text_type(self)
        signode.append(nodes.Text(txt, txt))


class ASTIdentifier(ASTBase):
    def __init__(self, identifier):
        # type: (unicode) -> None
        assert identifier is not None
        self.identifier = identifier

    def get_id_v1(self):
        # type: () -> unicode
        if self.identifier == 'size_t':
            return 's'
        else:
            return self.identifier

    def get_id_v2(self):
        # type: () -> unicode
        if self.identifier == "std":
            return 'St'
        elif self.identifier[0] == "~":
            # a destructor, just use an arbitrary version of dtors
            return 'D0'
        else:
            return text_type(len(self.identifier)) + self.identifier

    def __unicode__(self):
        # type: () -> unicode
        return self.identifier

    def describe_signature(self, signode, mode, env, prefix, symbol):
        # type: (addnodes.desc_signature, unicode, BuildEnvironment, unicode, Symbol) -> None
        _verify_description_mode(mode)
        if mode == 'markType':
            targetText = prefix + self.identifier
            pnode = addnodes.pending_xref('', refdomain='cpp',
                                          reftype='typeOrConcept',
                                          reftarget=targetText, modname=None,
                                          classname=None)
            key = symbol.get_lookup_key()
            assert key
            pnode['cpp:parent_key'] = key
            pnode += nodes.Text(self.identifier)
            signode += pnode
        elif mode == 'lastIsName':
            signode += addnodes.desc_name(self.identifier, self.identifier)
        elif mode == 'noneIsName':
            signode += nodes.Text(self.identifier)
        else:
            raise Exception('Unknown description mode: %s' % mode)


class ASTTemplateKeyParamPackIdDefault(ASTBase):
    def __init__(self, key, identifier, parameterPack, default):
        # type: (unicode, Any, bool, Any) -> None
        assert key
        if parameterPack:
            assert default is None
        self.key = key
        self.identifier = identifier
        self.parameterPack = parameterPack
        self.default = default

    def get_identifier(self):
        # type: () -> unicode
        return self.identifier

    def get_id_v2(self):
        # type: () -> unicode
        # this is not part of the normal name mangling in C++
        res = []
        if self.parameterPack:
            res.append('Dp')
        else:
            res.append('0')  # we need to put something
        return ''.join(res)

    def __unicode__(self):
        # type: () -> unicode
        res = [self.key]  # type: List[unicode]
        if self.parameterPack:
            if self.identifier:
                res.append(' ')
            res.append('...')
        if self.identifier:
            if not self.parameterPack:
                res.append(' ')
            res.append(text_type(self.identifier))
        if self.default:
            res.append(' = ')
            res.append(text_type(self.default))
        return ''.join(res)

    def describe_signature(self, signode, mode, env, symbol):
        # type: (addnodes.desc_signature, unicode, BuildEnvironment, Symbol) -> None
        signode += nodes.Text(self.key)
        if self.parameterPack:
            if self.identifier:
                signode += nodes.Text(' ')
            signode += nodes.Text('...')
        if self.identifier:
            if not self.parameterPack:
                signode += nodes.Text(' ')
            self.identifier.describe_signature(signode, mode, env, '', symbol)
        if self.default:
            signode += nodes.Text(' = ')
            self.default.describe_signature(signode, 'markType', env, symbol)


class ASTTemplateParamType(ASTBase):
    def __init__(self, data):
        # type: (Any) -> None
        assert data
        self.data = data

    @property
    def name(self):
        # type: () -> ASTNestedName
        id = self.get_identifier()
        return ASTNestedName([ASTNestedNameElement(id, None)], rooted=False)

    def get_identifier(self):
        # type: () -> unicode
        return self.data.get_identifier()

    def get_id_v2(self, objectType=None, symbol=None):
        # type: (unicode, Symbol) -> unicode
        # this is not part of the normal name mangling in C++
        if symbol:
            # the anchor will be our parent
            return symbol.parent.declaration.get_id_v2(prefixed=None)
        else:
            return self.data.get_id_v2()

    def __unicode__(self):
        # type: () -> unicode
        return text_type(self.data)

    def describe_signature(self, signode, mode, env, symbol):
        # type: (addnodes.desc_signature, unicode, BuildEnvironment, Symbol) -> None
        self.data.describe_signature(signode, mode, env, symbol)


class ASTTemplateParamTemplateType(ASTBase):
    def __init__(self, nestedParams, data):
        # type: (Any, Any) -> None
        assert nestedParams
        assert data
        self.nestedParams = nestedParams
        self.data = data

    @property
    def name(self):
        # type: () -> ASTNestedName
        id = self.get_identifier()
        return ASTNestedName([ASTNestedNameElement(id, None)], rooted=False)

    def get_identifier(self):
        # type: () -> unicode
        return self.data.get_identifier()

    def get_id_v2(self, objectType=None, symbol=None):
        # type: (unicode, Symbol) -> unicode
        # this is not part of the normal name mangling in C++
        if symbol:
            # the anchor will be our parent
            return symbol.parent.declaration.get_id_v2(prefixed=None)
        else:
            return self.nestedParams.get_id_v2() + self.data.get_id_v2()

    def __unicode__(self):
        # type: () -> unicode
        return text_type(self.nestedParams) + text_type(self.data)

    def describe_signature(self, signode, mode, env, symbol):
        # type: (addnodes.desc_signature, unicode, BuildEnvironment, Symbol) -> None
        self.nestedParams.describe_signature(signode, 'noneIsName', env, symbol)
        signode += nodes.Text(' ')
        self.data.describe_signature(signode, mode, env, symbol)


class ASTTemplateParamNonType(ASTBase):
    def __init__(self, param):
        # type: (Any) -> None
        assert param
        self.param = param

    @property
    def name(self):
        # type: () -> ASTNestedName
        id = self.get_identifier()
        return ASTNestedName([ASTNestedNameElement(id, None)], rooted=False)

    def get_identifier(self):
        # type: () -> unicode
        name = self.param.name
        if name:
            assert len(name.names) == 1
            assert name.names[0].identifier
            assert not name.names[0].templateArgs
            return name.names[0].identifier
        else:
            return None

    def get_id_v2(self, objectType=None, symbol=None):
        # type: (unicode, Symbol) -> unicode
        # this is not part of the normal name mangling in C++
        if symbol:
            # the anchor will be our parent
            return symbol.parent.declaration.get_id_v2(prefixed=None)
        else:
            return '_' + self.param.get_id_v2()

    def __unicode__(self):
        # type: () -> unicode
        return text_type(self.param)

    def describe_signature(self, signode, mode, env, symbol):
        # type: (addnodes.desc_signature, unicode, BuildEnvironment, Symbol) -> None
        self.param.describe_signature(signode, mode, env, symbol)


class ASTTemplateParams(ASTBase):
    def __init__(self, params):
        # type: (Any) -> None
        assert params is not None
        self.params = params
        self.isNested = False  # whether it's a template template param

    def get_id_v2(self):
        # type: () -> unicode
        res = []
        res.append("I")
        for param in self.params:
            res.append(param.get_id_v2())
        res.append("E")
        return ''.join(res)

    def __unicode__(self):
        # type: () -> unicode
        res = []
        res.append(u"template<")
        res.append(u", ".join(text_type(a) for a in self.params))
        res.append(u"> ")
        return ''.join(res)

    def describe_signature(self, parentNode, mode, env, symbol, lineSpec=None):
        # type: (addnodes.desc_signature, unicode, BuildEnvironment, Symbol, bool) -> None
        # 'lineSpec' is defaulted becuase of template template parameters
        def makeLine(parentNode=parentNode):
            signode = addnodes.desc_signature_line()
            parentNode += signode
            signode.sphinx_cpp_tagname = 'templateParams'
            return signode
        if self.isNested:
            lineNode = parentNode
        else:
            lineNode = makeLine()
        lineNode += nodes.Text("template<")
        first = True
        for param in self.params:
            if not first:
                lineNode += nodes.Text(", ")
            first = False
            if lineSpec:
                lineNode = makeLine()
            param.describe_signature(lineNode, mode, env, symbol)
        if lineSpec and not first:
            lineNode = makeLine()
        lineNode += nodes.Text(">")


class ASTTemplateIntroductionParameter(ASTBase):
    def __init__(self, identifier, parameterPack):
        # type: (Any, Any) -> None
        self.identifier = identifier
        self.parameterPack = parameterPack

    def get_identifier(self):
        # type: () -> unicode
        return self.identifier

    def get_id_v2(self, objectType=None, symbol=None):
        # type: (unicode, Symbol) -> unicode
        # this is not part of the normal name mangling in C++
        if symbol:
            # the anchor will be our parent
            return symbol.parent.declaration.get_id_v2(prefixed=None)
        else:
            if self.parameterPack:
                return 'Dp'
            else:
                return '0'  # we need to put something

    def get_id_v2_as_arg(self):
        # type: () -> unicode
        # used for the implicit requires clause
        res = self.identifier.get_id_v2()
        if self.parameterPack:
            return u'sp' + res
        else:
            return res

    def __unicode__(self):
        # type: () -> unicode
        res = []  # type: List[unicode]
        if self.parameterPack:
            res.append('...')
        res.append(text_type(self.identifier))
        return ''.join(res)

    def describe_signature(self, signode, mode, env, symbol):
        # type: (addnodes.desc_signature, unicode, BuildEnvironment, Symbol) -> None
        if self.parameterPack:
            signode += nodes.Text('...')
        self.identifier.describe_signature(signode, mode, env, '', symbol)


class ASTTemplateIntroduction(ASTBase):
    def __init__(self, concept, params):
        # type: (Any, List[Any]) -> None
        assert len(params) > 0
        self.concept = concept
        self.params = params

    # id_v1 does not exist

    def get_id_v2(self):
        # type: () -> unicode
        # first do the same as a normal template parameter list
        res = []
        res.append("I")
        for param in self.params:
            res.append(param.get_id_v2())
        res.append("E")
        # let's use X expr E, which is otherwise for constant template args
        res.append("X")
        res.append(self.concept.get_id_v2())
        res.append("I")
        for param in self.params:
            res.append(param.get_id_v2_as_arg())
        res.append("E")
        res.append("E")
        return ''.join(res)

    def __unicode__(self):
        # type: () -> unicode
        res = []
        res.append(text_type(self.concept))
        res.append('{')
        res.append(', '.join(text_type(param) for param in self.params))
        res.append('} ')
        return ''.join(res)

    def describe_signature(self, parentNode, mode, env, symbol, lineSpec):
        # type: (addnodes.desc_signature, unicode, BuildEnvironment, Symbol, bool) -> None
        # Note: 'lineSpec' has no effect on template introductions.
        signode = addnodes.desc_signature_line()
        parentNode += signode
        signode.sphinx_cpp_tagname = 'templateIntroduction'
        self.concept.describe_signature(signode, 'markType', env, symbol)
        signode += nodes.Text('{')
        first = True
        for param in self.params:
            if not first:
                signode += nodes.Text(', ')
            first = False
            param.describe_signature(signode, mode, env, symbol)
        signode += nodes.Text('}')


class ASTTemplateDeclarationPrefix(ASTBase):
    def __init__(self, templates):
        # type: (List[Any]) -> None
        assert templates is not None
        assert len(templates) > 0
        self.templates = templates

    # id_v1 does not exist

    def get_id_v2(self):
        # type: () -> unicode
        # this is not part of a normal name mangling system
        res = []
        for t in self.templates:
            res.append(t.get_id_v2())
        return u''.join(res)

    def __unicode__(self):
        # type: () -> unicode
        res = []
        for t in self.templates:
            res.append(text_type(t))
        return u''.join(res)

    def describe_signature(self, signode, mode, env, symbol, lineSpec):
        # type: (addnodes.desc_signature, unicode, BuildEnvironment, Symbol, bool) -> None
        _verify_description_mode(mode)
        for t in self.templates:
            t.describe_signature(signode, 'lastIsName', env, symbol, lineSpec)


class ASTOperatorBuildIn(ASTBase):
    def __init__(self, op):
        # type: (unicode) -> None
        self.op = op

    def is_operator(self):
        # type: () -> bool
        return True

    def get_id_v1(self):
        # type: () -> unicode
        if self.op not in _id_operator_v1:
            raise Exception('Internal error: Build-in operator "%s" can not '
                            'be mapped to an id.' % self.op)
        return _id_operator_v1[self.op]

    def get_id_v2(self):
        # type: () -> unicode
        if self.op not in _id_operator_v2:
            raise Exception('Internal error: Build-in operator "%s" can not '
                            'be mapped to an id.' % self.op)
        return _id_operator_v2[self.op]

    def __unicode__(self):
        # type: () -> unicode
        if self.op in ('new', 'new[]', 'delete', 'delete[]'):
            return u'operator ' + self.op
        else:
            return u'operator' + self.op

    def describe_signature(self, signode, mode, env, prefix, symbol):
        # type: (addnodes.desc_signature, unicode, BuildEnvironment, unicode, Symbol) -> None
        _verify_description_mode(mode)
        identifier = text_type(self)
        if mode == 'lastIsName':
            signode += addnodes.desc_name(identifier, identifier)
        else:
            signode += addnodes.desc_addname(identifier, identifier)


class ASTOperatorType(ASTBase):
    def __init__(self, type):
        # type: (Any) -> None
        self.type = type

    def is_operator(self):
        # type: () -> bool
        return True

    def get_id_v1(self):
        # type: () -> unicode
        return u'castto-%s-operator' % self.type.get_id_v1()

    def get_id_v2(self):
        # type: () -> unicode
        return u'cv' + self.type.get_id_v2()

    def __unicode__(self):
        # type: () -> unicode
        return u''.join(['operator ', text_type(self.type)])

    def get_name_no_template(self):
        # type: () -> unicode
        return text_type(self)

    def describe_signature(self, signode, mode, env, prefix, symbol):
        # type: (addnodes.desc_signature, unicode, BuildEnvironment, unicode, Symbol) -> None
        _verify_description_mode(mode)
        identifier = text_type(self)
        if mode == 'lastIsName':
            signode += addnodes.desc_name(identifier, identifier)
        else:
            signode += addnodes.desc_addname(identifier, identifier)


class ASTOperatorLiteral(ASTBase):
    def __init__(self, identifier):
        # type: (Any) -> None
        self.identifier = identifier

    def is_operator(self):
        # type: () -> bool
        return True

    def get_id_v1(self):
        # type: () -> unicode
        raise NoOldIdError()

    def get_id_v2(self):
        # type: () -> unicode
        return u'li' + self.identifier.get_id_v2()

    def __unicode__(self):
        # type: () -> unicode
        return u'operator""' + text_type(self.identifier)

    def describe_signature(self, signode, mode, env, prefix, symbol):
        # type: (addnodes.desc_signature, unicode, BuildEnvironment, unicode, Symbol) -> None
        _verify_description_mode(mode)
        identifier = text_type(self)
        if mode == 'lastIsName':
            signode += addnodes.desc_name(identifier, identifier)
        else:
            signode += addnodes.desc_addname(identifier, identifier)


class ASTTemplateArgConstant(ASTBase):
    def __init__(self, value):
        # type: (Any) -> None
        self.value = value

    def __unicode__(self):
        # type: () -> unicode
        return text_type(self.value)

    def get_id_v1(self):
        # type: () -> unicode
        return text_type(self).replace(u' ', u'-')

    def get_id_v2(self):
        # type: () -> unicode
        # TODO: doing this properly needs parsing of expressions, let's just
        # juse it verbatim for now
        return u'X' + text_type(self) + u'E'

    def describe_signature(self, signode, mode, env, symbol):
        # type: (addnodes.desc_signature, unicode, BuildEnvironment, Symbol) -> None
        _verify_description_mode(mode)
        signode += nodes.Text(text_type(self))


class ASTTemplateArgs(ASTBase):
    def __init__(self, args):
        # type: (List[Any]) -> None
        assert args is not None
        assert len(args) > 0
        self.args = args

    def get_id_v1(self):
        # type: () -> unicode
        res = []  # type: List[unicode]
        res.append(':')
        res.append(u'.'.join(a.get_id_v1() for a in self.args))
        res.append(':')
        return u''.join(res)

    def get_id_v2(self):
        # type: () -> unicode
        res = []
        res.append('I')
        for a in self.args:
            res.append(a.get_id_v2())
        res.append('E')
        return u''.join(res)

    def __unicode__(self):
        # type: () -> unicode
        res = ', '.join(text_type(a) for a in self.args)
        return '<' + res + '>'

    def describe_signature(self, signode, mode, env, symbol):
        # type: (addnodes.desc_signature, unicode, BuildEnvironment, Symbol) -> None
        _verify_description_mode(mode)
        signode += nodes.Text('<')
        first = True
        for a in self.args:
            if not first:
                signode += nodes.Text(', ')
            first = False
            a.describe_signature(signode, 'markType', env, symbol=symbol)
        signode += nodes.Text('>')


class ASTNestedNameElement(ASTBase):
    def __init__(self, identifier, templateArgs):
        # type: (Any, Any) -> None
        self.identifier = identifier
        self.templateArgs = templateArgs

    def is_operator(self):
        # type: () -> bool
        return False

    def get_id_v1(self):
        # type: () -> unicode
        res = self.identifier.get_id_v1()
        if self.templateArgs:
            res += self.templateArgs.get_id_v1()
        return res

    def get_id_v2(self):
        # type: () -> unicode
        res = self.identifier.get_id_v2()
        if self.templateArgs:
            res += self.templateArgs.get_id_v2()
        return res

    def __unicode__(self):
        # type: () -> unicode
        res = text_type(self.identifier)
        if self.templateArgs:
            res += text_type(self.templateArgs)
        return res

    def describe_signature(self, signode, mode, env, prefix, symbol):
        # type: (addnodes.desc_signature, unicode, BuildEnvironment, unicode, Symbol) -> None
        self.identifier.describe_signature(signode, mode, env, prefix, symbol)
        if self.templateArgs:
            self.templateArgs.describe_signature(signode, mode, env, symbol)


class ASTNestedName(ASTBase):
    def __init__(self, names, rooted):
        # type: (List[Any], bool) -> None
        assert len(names) > 0
        self.names = names
        self.rooted = rooted

    @property
    def name(self):
        # type: () -> ASTNestedName
        return self

    def num_templates(self):
        # type: () -> int
        count = 0
        for n in self.names:
            if n.is_operator():
                continue
            if n.templateArgs:
                count += 1
        return count

    def get_id_v1(self):
        # type: () -> unicode
        tt = text_type(self)
        if tt in _id_shorthands_v1:
            return _id_shorthands_v1[tt]
        else:
            return u'::'.join(n.get_id_v1() for n in self.names)

    def get_id_v2(self, modifiers=""):
        # type: (unicode) -> unicode
        res = []  # type: List[unicode]
        if len(self.names) > 1 or len(modifiers) > 0:
            res.append('N')
        res.append(modifiers)
        for n in self.names:
            res.append(n.get_id_v2())
        if len(self.names) > 1 or len(modifiers) > 0:
            res.append('E')
        return u''.join(res)

    def __unicode__(self):
        # type: () -> unicode
        res = []  # type: List[unicode]
        if self.rooted:
            res.append('')
        for n in self.names:
            res.append(text_type(n))
        return '::'.join(res)

    def describe_signature(self, signode, mode, env, symbol):
        # type: (addnodes.desc_signature, unicode, BuildEnvironment, Symbol) -> None
        _verify_description_mode(mode)
        # just print the name part, with template args, not template params
        if mode == 'lastIsName':
            addname = []  # type: List[unicode]
            if self.rooted:
                addname.append('')
            for n in self.names[:-1]:
                addname.append(text_type(n))
            addname = '::'.join(addname)  # type: ignore
            if len(self.names) > 1:
                addname += '::'
            signode += addnodes.desc_addname(addname, addname)
            self.names[-1].describe_signature(signode, mode, env, '', symbol)
        elif mode == 'noneIsName':
            signode += nodes.Text(text_type(self))
        elif mode == 'param':
            name = text_type(self)
            signode += nodes.emphasis(name, name)
        elif mode == 'markType':
            # each element should be a pending xref targeting the complete
            # prefix. however, only the identifier part should be a link, such
            # that template args can be a link as well.
            prefix = ''  # type: unicode
            first = True
            for name in self.names:
                if not first:
                    signode += nodes.Text('::')
                    prefix += '::'
                first = False
                if name != '':
                    name.describe_signature(signode, mode, env, prefix, symbol)  # type: ignore
                prefix += text_type(name)
        else:
            raise Exception('Unknown description mode: %s' % mode)


class ASTTrailingTypeSpecFundamental(ASTBase):
    def __init__(self, name):
        # type: (unicode) -> None
        self.name = name

    def __unicode__(self):
        # type: () -> unicode
        return self.name

    def get_id_v1(self):
        # type: () -> unicode
        res = []
        for a in self.name.split(' '):
            if a in _id_fundamental_v1:
                res.append(_id_fundamental_v1[a])
            else:
                res.append(a)
        return u'-'.join(res)

    def get_id_v2(self):
        # type: () -> unicode
        if self.name not in _id_fundamental_v2:
            raise Exception(
                'Semi-internal error: Fundamental type "%s" can not be mapped '
                'to an id. Is it a true fundamental type? If not so, the '
                'parser should have rejected it.' % self.name)
        return _id_fundamental_v2[self.name]

    def describe_signature(self, signode, mode, env, symbol):
        # type: (addnodes.desc_signature, unicode, BuildEnvironment, Symbol) -> None
        signode += nodes.Text(text_type(self.name))


class ASTTrailingTypeSpecName(ASTBase):
    def __init__(self, prefix, nestedName):
        # type: (unicode, Any) -> None
        self.prefix = prefix
        self.nestedName = nestedName

    @property
    def name(self):
        # type: () -> Any
        return self.nestedName

    def get_id_v1(self):
        # type: () -> unicode
        return self.nestedName.get_id_v1()

    def get_id_v2(self):
        # type: () -> unicode
        return self.nestedName.get_id_v2()

    def __unicode__(self):
        # type: () -> unicode
        res = []  # type: List[unicode]
        if self.prefix:
            res.append(self.prefix)
            res.append(' ')
        res.append(text_type(self.nestedName))
        return u''.join(res)

    def describe_signature(self, signode, mode, env, symbol):
        # type: (addnodes.desc_signature, unicode, BuildEnvironment, Symbol) -> None
        if self.prefix:
            signode += addnodes.desc_annotation(self.prefix, self.prefix)
            signode += nodes.Text(' ')
        self.nestedName.describe_signature(signode, mode, env, symbol=symbol)


class ASTFunctionParameter(ASTBase):
    def __init__(self, arg, ellipsis=False):
        # type: (Any, bool) -> None
        self.arg = arg
        self.ellipsis = ellipsis

    def get_id_v1(self):
        # type: () -> unicode
        if self.ellipsis:
            return 'z'
        else:
            return self.arg.get_id_v1()

    def get_id_v2(self):
        # type: () -> unicode
        if self.ellipsis:
            return 'z'
        else:
            return self.arg.get_id_v2()

    def __unicode__(self):
        # type: () -> unicode
        if self.ellipsis:
            return '...'
        else:
            return text_type(self.arg)

    def describe_signature(self, signode, mode, env, symbol):
        # type: (addnodes.desc_signature, unicode, BuildEnvironment, Symbol) -> None
        _verify_description_mode(mode)
        if self.ellipsis:
            signode += nodes.Text('...')
        else:
            self.arg.describe_signature(signode, mode, env, symbol=symbol)


class ASTParametersQualifiers(ASTBase):
    def __init__(self, args, volatile, const, refQual, exceptionSpec, override,
                 final, initializer):
        # type: (List[Any], bool, bool, unicode, unicode, bool, bool, unicode) -> None
        self.args = args
        self.volatile = volatile
        self.const = const
        self.refQual = refQual
        self.exceptionSpec = exceptionSpec
        self.override = override
        self.final = final
        self.initializer = initializer

    # Id v1 ------------------------------------------------------------------

    def get_modifiers_id_v1(self):
        # type: () -> unicode
        res = []
        if self.volatile:
            res.append('V')
        if self.const:
            res.append('C')
        if self.refQual == '&&':
            res.append('O')
        elif self.refQual == '&':
            res.append('R')
        return u''.join(res)

    def get_param_id_v1(self):
        # type: () -> unicode
        if len(self.args) == 0:
            return ''
        else:
            return u'__' + u'.'.join(a.get_id_v1() for a in self.args)

    # Id v2 ------------------------------------------------------------------

    def get_modifiers_id_v2(self):
        # type: () -> unicode
        res = []
        if self.volatile:
            res.append('V')
        if self.const:
            res.append('K')
        if self.refQual == '&&':
            res.append('O')
        elif self.refQual == '&':
            res.append('R')
        return u''.join(res)

    def get_param_id_v2(self):
        # type: () -> unicode
        if len(self.args) == 0:
            return 'v'
        else:
            return u''.join(a.get_id_v2() for a in self.args)

    def __unicode__(self):
        # type: () -> unicode
        res = []  # type: List[unicode]
        res.append('(')
        first = True
        for a in self.args:
            if not first:
                res.append(', ')
            first = False
            res.append(text_type(a))
        res.append(')')
        if self.volatile:
            res.append(' volatile')
        if self.const:
            res.append(' const')
        if self.refQual:
            res.append(' ')
            res.append(self.refQual)
        if self.exceptionSpec:
            res.append(' ')
            res.append(text_type(self.exceptionSpec))
        if self.final:
            res.append(' final')
        if self.override:
            res.append(' override')
        if self.initializer:
            res.append(' = ')
            res.append(self.initializer)
        return u''.join(res)

    def describe_signature(self, signode, mode, env, symbol):
        # type: (addnodes.desc_signature, unicode, BuildEnvironment, Symbol) -> None
        _verify_description_mode(mode)
        paramlist = addnodes.desc_parameterlist()
        for arg in self.args:
            param = addnodes.desc_parameter('', '', noemph=True)
            if mode == 'lastIsName':  # i.e., outer-function params
                arg.describe_signature(param, 'param', env, symbol=symbol)
            else:
                arg.describe_signature(param, 'markType', env, symbol=symbol)
            paramlist += param
        signode += paramlist

        def _add_anno(signode, text):
            signode += nodes.Text(' ')
            signode += addnodes.desc_annotation(text, text)

        def _add_text(signode, text):
            signode += nodes.Text(' ' + text)

        if self.volatile:
            _add_anno(signode, 'volatile')
        if self.const:
            _add_anno(signode, 'const')
        if self.refQual:
            _add_text(signode, self.refQual)
        if self.exceptionSpec:
            _add_anno(signode, text_type(self.exceptionSpec))
        if self.final:
            _add_anno(signode, 'final')
        if self.override:
            _add_anno(signode, 'override')
        if self.initializer:
            _add_text(signode, '= ' + text_type(self.initializer))


class ASTDeclSpecsSimple(ASTBase):
    def __init__(self, storage, threadLocal, inline, virtual, explicit,
                 constexpr, volatile, const, friend, attrs):
        # type: (unicode, bool, bool, bool, bool, bool, bool, bool, bool, List[Any]) -> None
        self.storage = storage
        self.threadLocal = threadLocal
        self.inline = inline
        self.virtual = virtual
        self.explicit = explicit
        self.constexpr = constexpr
        self.volatile = volatile
        self.const = const
        self.friend = friend
        self.attrs = attrs

    def mergeWith(self, other):
        # type: (ASTDeclSpecsSimple) -> ASTDeclSpecsSimple
        if not other:
            return self
        return ASTDeclSpecsSimple(self.storage or other.storage,
                                  self.threadLocal or other.threadLocal,
                                  self.inline or other.inline,
                                  self.virtual or other.virtual,
                                  self.explicit or other.explicit,
                                  self.constexpr or other.constexpr,
                                  self.volatile or other.volatile,
                                  self.const or other.const,
                                  self.friend or other.friend,
                                  self.attrs + other.attrs)

    def __unicode__(self):
        # type: () -> unicode
        res = []  # type: List[unicode]
        res.extend(text_type(attr) for attr in self.attrs)
        if self.storage:
            res.append(self.storage)
        if self.threadLocal:
            res.append('thread_local')
        if self.inline:
            res.append('inline')
        if self.friend:
            res.append('friend')
        if self.virtual:
            res.append('virtual')
        if self.explicit:
            res.append('explicit')
        if self.constexpr:
            res.append('constexpr')
        if self.volatile:
            res.append('volatile')
        if self.const:
            res.append('const')
        return u' '.join(res)

    def describe_signature(self, modifiers):
        # type: (List[nodes.Node]) -> None
        def _add(modifiers, text):
            if len(modifiers) > 0:
                modifiers.append(nodes.Text(' '))
            modifiers.append(addnodes.desc_annotation(text, text))
        for attr in self.attrs:
            if len(modifiers) > 0:
                modifiers.append(nodes.Text(' '))
            modifiers.append(attr.describe_signature(modifiers))
        if self.storage:
            _add(modifiers, self.storage)
        if self.threadLocal:
            _add(modifiers, 'thread_local')
        if self.inline:
            _add(modifiers, 'inline')
        if self.friend:
            _add(modifiers, 'friend')
        if self.virtual:
            _add(modifiers, 'virtual')
        if self.explicit:
            _add(modifiers, 'explicit')
        if self.constexpr:
            _add(modifiers, 'constexpr')
        if self.volatile:
            _add(modifiers, 'volatile')
        if self.const:
            _add(modifiers, 'const')


class ASTDeclSpecs(ASTBase):
    def __init__(self, outer, leftSpecs, rightSpecs, trailing):
        # leftSpecs and rightSpecs are used for output
        # allSpecs are used for id generation
        self.outer = outer
        self.leftSpecs = leftSpecs
        self.rightSpecs = rightSpecs
        self.allSpecs = self.leftSpecs.mergeWith(self.rightSpecs)
        self.trailingTypeSpec = trailing

    @property
    def name(self):
        # type: () -> unicode
        return self.trailingTypeSpec.name

    def get_id_v1(self):
        # type: () -> unicode
        res = []
        res.append(self.trailingTypeSpec.get_id_v1())
        if self.allSpecs.volatile:
            res.append('V')
        if self.allSpecs.const:
            res.append('C')
        return u''.join(res)

    def get_id_v2(self):
        # type: () -> unicode
        res = []
        if self.leftSpecs.volatile or self.rightSpecs.volatile:
            res.append('V')
        if self.leftSpecs.const or self.rightSpecs.volatile:
            res.append('K')
        res.append(self.trailingTypeSpec.get_id_v2())
        return u''.join(res)

    def __unicode__(self):
        # type: () -> unicode
        res = []  # type: List[unicode]
        l = text_type(self.leftSpecs)
        if len(l) > 0:
            if len(res) > 0:
                res.append(" ")
            res.append(l)
        if self.trailingTypeSpec:
            if len(res) > 0:
                res.append(" ")
            res.append(text_type(self.trailingTypeSpec))
            r = text_type(self.rightSpecs)
            if len(r) > 0:
                if len(res) > 0:
                    res.append(" ")
                res.append(r)
        return "".join(res)

    def describe_signature(self, signode, mode, env, symbol):
        # type: (addnodes.desc_signature, unicode, BuildEnvironment, Symbol) -> None
        _verify_description_mode(mode)
        modifiers = []  # type: List[nodes.Node]

        def _add(modifiers, text):
            if len(modifiers) > 0:
                modifiers.append(nodes.Text(' '))
            modifiers.append(addnodes.desc_annotation(text, text))

        self.leftSpecs.describe_signature(modifiers)

        for m in modifiers:
            signode += m
        if self.trailingTypeSpec:
            if len(modifiers) > 0:
                signode += nodes.Text(' ')
            self.trailingTypeSpec.describe_signature(signode, mode, env,
                                                     symbol=symbol)
            modifiers = []
            self.rightSpecs.describe_signature(modifiers)
            if len(modifiers) > 0:
                signode += nodes.Text(' ')
            for m in modifiers:
                signode += m


class ASTArray(ASTBase):
    def __init__(self, size):
        # type: (unicode) -> None
        self.size = size

    def __unicode__(self):
        # type: () -> unicode
        return u''.join(['[', text_type(self.size), ']'])

    def get_id_v1(self):
        # type: () -> unicode
        return u'A'

    def get_id_v2(self):
        # type: () -> unicode
        # TODO: this should maybe be done differently
        return u'A' + text_type(self.size) + u'_'

    def describe_signature(self, signode, mode, env):
        _verify_description_mode(mode)
        signode += nodes.Text(text_type(self))


class ASTDeclaratorPtr(ASTBase):
    def __init__(self, next, volatile, const):
        # type: (Any, bool, bool) -> None
        assert next
        self.next = next
        self.volatile = volatile
        self.const = const

    @property
    def name(self):
        # type: () -> unicode
        return self.next.name

    def require_space_after_declSpecs(self):
        # type: () -> bool
        # TODO: if has paramPack, then False ?
        return True

    def __unicode__(self):
        # type: () -> unicode
        res = ['*']  # type: List[unicode]
        if self.volatile:
            res.append('volatile')
        if self.const:
            if self.volatile:
                res.append(' ')
            res.append('const')
        if self.const or self.volatile:
            if self.next.require_space_after_declSpecs:
                res.append(' ')
        res.append(text_type(self.next))
        return u''.join(res)

    # Id v1 ------------------------------------------------------------------

    def get_modifiers_id_v1(self):
        # type: () -> unicode
        return self.next.get_modifiers_id_v1()

    def get_param_id_v1(self):
        # type: () -> unicode
        return self.next.get_param_id_v1()

    def get_ptr_suffix_id_v1(self):
        # type: () -> unicode
        res = 'P'
        if self.volatile:
            res += 'V'
        if self.const:
            res += 'C'
        return res + self.next.get_ptr_suffix_id_v1()

    # Id v2 ------------------------------------------------------------------

    def get_modifiers_id_v2(self):
        # type: () -> unicode
        return self.next.get_modifiers_id_v2()

    def get_param_id_v2(self):
        # type: () -> unicode
        return self.next.get_param_id_v2()

    def get_ptr_suffix_id_v2(self):
        # type: () -> unicode
        res = [self.next.get_ptr_suffix_id_v2()]  # type: List[unicode]
        res.append('P')
        if self.volatile:
            res.append('V')
        if self.const:
            res.append('C')
        return u''.join(res)

    def get_type_id_v2(self, returnTypeId):
        # type: (unicode) -> unicode
        # ReturnType *next, so we are part of the return type of 'next
        res = ['P']  # type: List[unicode]
        if self.volatile:
            res.append('V')
        if self.const:
            res.append('C')
        res.append(returnTypeId)
        return self.next.get_type_id_v2(returnTypeId=u''.join(res))

    # ------------------------------------------------------------------------

    def is_function_type(self):
        # type: () -> bool
        return self.next.is_function_type()

    def describe_signature(self, signode, mode, env, symbol):
        # type: (addnodes.desc_signature, unicode, BuildEnvironment, Symbol) -> None
        _verify_description_mode(mode)
        signode += nodes.Text("*")

        def _add_anno(signode, text):
            signode += addnodes.desc_annotation(text, text)
        if self.volatile:
            _add_anno(signode, 'volatile')
        if self.const:
            if self.volatile:
                signode += nodes.Text(' ')
            _add_anno(signode, 'const')
        if self.const or self.volatile:
            if self.next.require_space_after_declSpecs:
                signode += nodes.Text(' ')
        self.next.describe_signature(signode, mode, env, symbol)


class ASTDeclaratorRef(ASTBase):
    def __init__(self, next):
        # type: (Any) -> None
        assert next
        self.next = next

    @property
    def name(self):
        # type: () -> unicode
        return self.next.name

    def require_space_after_declSpecs(self):
        # type: () -> bool
        return self.next.require_space_after_declSpecs()

    def __unicode__(self):
        # type: () -> unicode
        return '&' + text_type(self.next)

    # Id v1 ------------------------------------------------------------------

    def get_modifiers_id_v1(self):
        # type: () -> unicode
        return self.next.get_modifiers_id_v1()

    def get_param_id_v1(self):  # only the parameters (if any)
        # type: () -> unicode
        return self.next.get_param_id_v1()

    def get_ptr_suffix_id_v1(self):
        # type: () -> unicode
        return u'R' + self.next.get_ptr_suffix_id_v1()

    # Id v2 ------------------------------------------------------------------

    def get_modifiers_id_v2(self):
        # type: () -> unicode
        return self.next.get_modifiers_id_v2()

    def get_param_id_v2(self):  # only the parameters (if any)
        # type: () -> unicode
        return self.next.get_param_id_v2()

    def get_ptr_suffix_id_v2(self):
        # type: () -> unicode
        return self.next.get_ptr_suffix_id_v2() + u'R'

    def get_type_id_v2(self, returnTypeId):
        # type: (unicode) -> unicode
        # ReturnType &next, so we are part of the return type of 'next
        return self.next.get_type_id_v2(returnTypeId=u'R' + returnTypeId)

    # ------------------------------------------------------------------------

    def is_function_type(self):
        # type: () -> bool
        return self.next.is_function_type()

    def describe_signature(self, signode, mode, env, symbol):
        # type: (addnodes.desc_signature, unicode, BuildEnvironment, Symbol) -> None
        _verify_description_mode(mode)
        signode += nodes.Text("&")
        self.next.describe_signature(signode, mode, env, symbol)


class ASTDeclaratorParamPack(ASTBase):
    def __init__(self, next):
        # type: (Any) -> None
        assert next
        self.next = next

    @property
    def name(self):
        # type: () -> unicode
        return self.next.name

    def require_space_after_declSpecs(self):
        # type: () -> bool
        return False

    def __unicode__(self):
        # type: () -> unicode
        res = text_type(self.next)
        if self.next.name:
            res = ' ' + res
        return '...' + res

    # Id v1 ------------------------------------------------------------------

    def get_modifiers_id_v1(self):
        # type: () -> unicode
        return self.next.get_modifiers_id_v1()

    def get_param_id_v1(self):  # only the parameters (if any)
        # type: () -> unicode
        return self.next.get_param_id_v1()

    def get_ptr_suffix_id_v1(self):
        # type: () -> unicode
        return 'Dp' + self.next.get_ptr_suffix_id_v2()

    # Id v2 ------------------------------------------------------------------

    def get_modifiers_id_v2(self):
        # type: () -> unicode
        return self.next.get_modifiers_id_v2()

    def get_param_id_v2(self):  # only the parameters (if any)
        return self.next.get_param_id_v2()

    def get_ptr_suffix_id_v2(self):
        # type: () -> unicode
        return self.next.get_ptr_suffix_id_v2() + u'Dp'

    def get_type_id_v2(self, returnTypeId):
        # type: (unicode) -> unicode
        # ReturnType... next, so we are part of the return type of 'next
        return self.next.get_type_id_v2(returnTypeId=u'Dp' + returnTypeId)

    # ------------------------------------------------------------------------

    def is_function_type(self):
        # type: () -> bool
        return self.next.is_function_type()

    def describe_signature(self, signode, mode, env, symbol):
        # type: (addnodes.desc_signature, unicode, BuildEnvironment, Symbol) -> None
        _verify_description_mode(mode)
        signode += nodes.Text("...")
        if self.next.name:
            signode += nodes.Text(' ')
        self.next.describe_signature(signode, mode, env, symbol)


class ASTDeclaratorMemPtr(ASTBase):
    def __init__(self, className, const, volatile, next):
        # type: (Any, bool, bool, Any) -> None
        assert className
        assert next
        self.className = className
        self.const = const
        self.volatile = volatile
        self.next = next

    @property
    def name(self):
        # type: () -> unicode
        return self.next.name

    def require_space_after_declSpecs(self):
        # type: () -> bool
        return True

    def __unicode__(self):
        # type: () -> unicode
        res = []
        res.append(text_type(self.className))
        res.append('::*')
        if self.volatile:
            res.append(' volatile')
        if self.const:
            res.append(' const')
        if self.next.require_space_after_declSpecs():
            res.append(' ')
        res.append(text_type(self.next))
        return ''.join(res)

    # Id v1 ------------------------------------------------------------------

    def get_modifiers_id_v1(self):
        # type: () -> unicode
        raise NoOldIdError()

    def get_param_id_v1(self):  # only the parameters (if any)
        # type: () -> unicode
        raise NoOldIdError()

    def get_ptr_suffix_id_v1(self):
        # type: () -> unicode
        raise NoOldIdError()

    # Id v2 ------------------------------------------------------------------

    def get_modifiers_id_v2(self):
        # type: () -> unicode
        return self.next.get_modifiers_id_v2()

    def get_param_id_v2(self):  # only the parameters (if any)
        # type: () -> unicode
        return self.next.get_param_id_v2()

    def get_ptr_suffix_id_v2(self):
        # type: () -> unicode
        raise NotImplementedError()
        return self.next.get_ptr_suffix_id_v2() + u'Dp'

    def get_type_id_v2(self, returnTypeId):
        # type: (unicode) -> unicode
        # ReturnType name::* next, so we are part of the return type of next
        nextReturnTypeId = ''  # type: unicode
        if self.volatile:
            nextReturnTypeId += 'V'
        if self.const:
            nextReturnTypeId += 'K'
        nextReturnTypeId += 'M'
        nextReturnTypeId += self.className.get_id_v2()
        nextReturnTypeId += returnTypeId
        return self.next.get_type_id_v2(nextReturnTypeId)

    # ------------------------------------------------------------------------

    def is_function_type(self):
        # type: () -> bool
        return self.next.is_function_type()

    def describe_signature(self, signode, mode, env, symbol):
        # type: (addnodes.desc_signature, unicode, BuildEnvironment, Symbol) -> None
        _verify_description_mode(mode)
        self.className.describe_signature(signode, mode, env, symbol)
        signode += nodes.Text('::*')

        def _add_anno(signode, text):
            signode += addnodes.desc_annotation(text, text)
        if self.volatile:
            _add_anno(signode, 'volatile')
        if self.const:
            if self.volatile:
                signode += nodes.Text(' ')
            _add_anno(signode, 'const')
        if self.next.require_space_after_declSpecs():
            if self.volatile or self.const:
                signode += nodes.Text(' ')
        self.next.describe_signature(signode, mode, env, symbol)


class ASTDeclaratorParen(ASTBase):
    def __init__(self, inner, next):
        # type: (Any, Any) -> None
        assert inner
        assert next
        self.inner = inner
        self.next = next
        # TODO: we assume the name, params, and qualifiers are in inner

    @property
    def name(self):
        # type: () -> unicode
        return self.inner.name

    def require_space_after_declSpecs(self):
        # type: () -> bool
        return True

    def __unicode__(self):
        # type: () -> unicode
        res = ['(']  # type: List[unicode]
        res.append(text_type(self.inner))
        res.append(')')
        res.append(text_type(self.next))
        return ''.join(res)

    # Id v1 ------------------------------------------------------------------

    def get_modifiers_id_v1(self):
        # type: () -> unicode
        return self.inner.get_modifiers_id_v1()

    def get_param_id_v1(self):  # only the parameters (if any)
        # type: () -> unicode
        return self.inner.get_param_id_v1()

    def get_ptr_suffix_id_v1(self):
        # type: () -> unicode
        raise NoOldIdError()  # TODO: was this implemented before?
        return self.next.get_ptr_suffix_id_v2() + \
            self.inner.get_ptr_suffix_id_v2()

    # Id v2 ------------------------------------------------------------------

    def get_modifiers_id_v2(self):
        # type: () -> unicode
        return self.inner.get_modifiers_id_v2()

    def get_param_id_v2(self):  # only the parameters (if any)
        # type: () -> unicode
        return self.inner.get_param_id_v2()

    def get_ptr_suffix_id_v2(self):
        # type: () -> unicode
        return self.inner.get_ptr_suffix_id_v2() + \
            self.next.get_ptr_suffix_id_v2()

    def get_type_id_v2(self, returnTypeId):
        # type: (unicode) -> unicode
        # ReturnType (inner)next, so 'inner' returns everything outside
        nextId = self.next.get_type_id_v2(returnTypeId)
        return self.inner.get_type_id_v2(returnTypeId=nextId)

    # ------------------------------------------------------------------------

    def is_function_type(self):
        # type: () -> bool
        return self.inner.is_function_type()

    def describe_signature(self, signode, mode, env, symbol):
        # type: (addnodes.desc_signature, unicode, BuildEnvironment, Symbol) -> None
        _verify_description_mode(mode)
        signode += nodes.Text('(')
        self.inner.describe_signature(signode, mode, env, symbol)
        signode += nodes.Text(')')
        self.next.describe_signature(signode, "noneIsName", env, symbol)


class ASTDeclaratorNameParamQual(ASTBase):
    def __init__(self, declId, arrayOps, paramQual):
        # type: (Any, List[Any], Any) -> None
        self.declId = declId
        self.arrayOps = arrayOps
        self.paramQual = paramQual

    @property
    def name(self):
        # type: () -> unicode
        return self.declId

    # Id v1 ------------------------------------------------------------------

    def get_modifiers_id_v1(self):  # only the modifiers for a function, e.g.,
        # type: () -> unicode
        # cv-qualifiers
        if self.paramQual:
            return self.paramQual.get_modifiers_id_v1()
        raise Exception(
            "This should only be called on a function: %s" % text_type(self))

    def get_param_id_v1(self):  # only the parameters (if any)
        # type: () -> unicode
        if self.paramQual:
            return self.paramQual.get_param_id_v1()
        else:
            return ''

    def get_ptr_suffix_id_v1(self):  # only the array specifiers
        # type: () -> unicode
        return u''.join(a.get_id_v1() for a in self.arrayOps)

    # Id v2 ------------------------------------------------------------------

    def get_modifiers_id_v2(self):  # only the modifiers for a function, e.g.,
        # type: () -> unicode
        # cv-qualifiers
        if self.paramQual:
            return self.paramQual.get_modifiers_id_v2()
        raise Exception(
            "This should only be called on a function: %s" % text_type(self))

    def get_param_id_v2(self):  # only the parameters (if any)
        # type: () -> unicode
        if self.paramQual:
            return self.paramQual.get_param_id_v2()
        else:
            return ''

    def get_ptr_suffix_id_v2(self):  # only the array specifiers
        # type: () -> unicode
        return u''.join(a.get_id_v2() for a in self.arrayOps)

    def get_type_id_v2(self, returnTypeId):
        # type: (unicode) -> unicode
        res = []
        # TOOD: can we actually have both array ops and paramQual?
        res.append(self.get_ptr_suffix_id_v2())
        if self.paramQual:
            res.append(self.get_modifiers_id_v2())
            res.append('F')
            res.append(returnTypeId)
            res.append(self.get_param_id_v2())
            res.append('E')
        else:
            res.append(returnTypeId)
        return u''.join(res)

    # ------------------------------------------------------------------------

    def require_space_after_declSpecs(self):
        # type: () -> bool
        return self.declId is not None

    def is_function_type(self):
        # type: () -> bool
        return self.paramQual is not None

    def __unicode__(self):
        # type: () -> unicode
        res = []
        if self.declId:
            res.append(text_type(self.declId))
        for op in self.arrayOps:
            res.append(text_type(op))
        if self.paramQual:
            res.append(text_type(self.paramQual))
        return u''.join(res)

    def describe_signature(self, signode, mode, env, symbol):
        # type: (addnodes.desc_signature, unicode, BuildEnvironment, Symbol) -> None
        _verify_description_mode(mode)
        if self.declId:
            self.declId.describe_signature(signode, mode, env, symbol)
        for op in self.arrayOps:
            op.describe_signature(signode, mode, env)
        if self.paramQual:
            self.paramQual.describe_signature(signode, mode, env, symbol)


class ASTInitializer(ASTBase):
    def __init__(self, value):
        # type: (unicode) -> None
        self.value = value

    def __unicode__(self):
        # type: () -> unicode
        return u''.join([' = ', text_type(self.value)])

    def describe_signature(self, signode, mode):
        # type: (addnodes.desc_signature, unicode) -> None
        _verify_description_mode(mode)
        signode += nodes.Text(text_type(self))


class ASTType(ASTBase):
    def __init__(self, declSpecs, decl):
        # type: (Any, Any) -> None
        assert declSpecs
        assert decl
        self.declSpecs = declSpecs
        self.decl = decl

    @property
    def name(self):
        # type: () -> unicode
        name = self.decl.name
        return name

    def get_id_v1(self, objectType=None, symbol=None):
        # type: (unicode, Symbol) -> unicode
        res = []
        if objectType:  # needs the name
            if objectType == 'function':  # also modifiers
                res.append(symbol.get_full_nested_name().get_id_v1())
                res.append(self.decl.get_param_id_v1())
                res.append(self.decl.get_modifiers_id_v1())
                if (self.declSpecs.leftSpecs.constexpr or
                        (self.declSpecs.rightSpecs and
                         self.declSpecs.rightSpecs.constexpr)):
                    res.append('CE')
            elif objectType == 'type':  # just the name
                res.append(symbol.get_full_nested_name().get_id_v1())
            else:
                print(objectType)
                assert False
        else:  # only type encoding
            if self.decl.is_function_type():
                raise NoOldIdError()
            res.append(self.declSpecs.get_id_v1())
            res.append(self.decl.get_ptr_suffix_id_v1())
            res.append(self.decl.get_param_id_v1())
        return u''.join(res)

    def get_id_v2(self, objectType=None, symbol=None):
        # type: (unicode, Symbol) -> unicode
        res = []
        if objectType:  # needs the name
            if objectType == 'function':  # also modifiers
                modifiers = self.decl.get_modifiers_id_v2()
                res.append(symbol.get_full_nested_name().get_id_v2(modifiers))
                res.append(self.decl.get_param_id_v2())
            elif objectType == 'type':  # just the name
                res.append(symbol.get_full_nested_name().get_id_v2())
            else:
                print(objectType)
                assert False
        else:  # only type encoding
            # the 'returnType' of a non-function type is simply just the last
            # type, i.e., for 'int*' it is 'int'
            returnTypeId = self.declSpecs.get_id_v2()
            typeId = self.decl.get_type_id_v2(returnTypeId)
            res.append(typeId)
        return u''.join(res)

    def __unicode__(self):
        # type: () -> unicode
        res = []
        declSpecs = text_type(self.declSpecs)
        res.append(declSpecs)
        if self.decl.require_space_after_declSpecs() and len(declSpecs) > 0:
            res.append(u' ')
        res.append(text_type(self.decl))
        return u''.join(res)

    def get_type_declaration_prefix(self):
        # type: () -> unicode
        if self.declSpecs.trailingTypeSpec:
            return 'typedef'
        else:
            return 'type'

    def describe_signature(self, signode, mode, env, symbol):
        # type: (addnodes.desc_signature, unicode, BuildEnvironment, Symbol) -> None
        _verify_description_mode(mode)
        self.declSpecs.describe_signature(signode, 'markType', env, symbol)
        if (self.decl.require_space_after_declSpecs() and
                len(text_type(self.declSpecs)) > 0):
            signode += nodes.Text(' ')
        self.decl.describe_signature(signode, mode, env, symbol)


class ASTTypeWithInit(ASTBase):
    def __init__(self, type, init):
        # type: (Any, Any) -> None
        self.type = type
        self.init = init

    @property
    def name(self):
        # type: () -> unicode
        return self.type.name

    def get_id_v1(self, objectType=None, symbol=None):
        # type: (unicode, Symbol) -> unicode
        if objectType == 'member':
            return symbol.get_full_nested_name().get_id_v1() + u'__' \
                + self.type.get_id_v1()
        else:
            return self.type.get_id_v1(objectType)

    def get_id_v2(self, objectType=None, symbol=None):
        # type: (unicode, Symbol) -> unicode
        if objectType == 'member':
            return symbol.get_full_nested_name().get_id_v2()
        else:
            return self.type.get_id_v2()

    def __unicode__(self):
        # type: () -> unicode
        res = []
        res.append(text_type(self.type))
        if self.init:
            res.append(text_type(self.init))
        return u''.join(res)

    def describe_signature(self, signode, mode, env, symbol):
        # type: (addnodes.desc_signature, unicode, BuildEnvironment, Symbol) -> None
        _verify_description_mode(mode)
        self.type.describe_signature(signode, mode, env, symbol=symbol)
        if self.init:
            self.init.describe_signature(signode, mode)


class ASTTypeUsing(ASTBase):
    def __init__(self, name, type):
        # type: (Any, Any) -> None
        self.name = name
        self.type = type

    def get_id_v1(self, objectType=None, symbol=None):
        # type: (unicode, Symbol) -> unicode
        raise NoOldIdError()

    def get_id_v2(self, objectType=None, symbol=None):
        # type: (unicode, Symbol) -> unicode
        return symbol.get_full_nested_name().get_id_v2()

    def __unicode__(self):
        # type: () -> unicode
        res = []
        res.append(text_type(self.name))
        if self.type:
            res.append(' = ')
            res.append(text_type(self.type))
        return u''.join(res)

    def get_type_declaration_prefix(self):
        # type: () -> unicode
        return 'using'

    def describe_signature(self, signode, mode, env, symbol):
        # type: (addnodes.desc_signature, unicode, BuildEnvironment, Symbol) -> None
        _verify_description_mode(mode)
        self.name.describe_signature(signode, mode, env, symbol=symbol)
        if self.type:
            signode += nodes.Text(' = ')
            self.type.describe_signature(signode, 'markType', env, symbol=symbol)


class ASTConcept(ASTBase):
    def __init__(self, nestedName, isFunction, initializer):
        # type: (Any, bool, Any) -> None
        self.nestedName = nestedName
        self.isFunction = isFunction  # otherwise it's a variable concept
        self.initializer = initializer

    @property
    def name(self):
        # type: () -> unicode
        return self.nestedName

    def get_id_v1(self, objectType=None, symbol=None):
        # type: (unicode, Symbol) -> unicode
        raise NoOldIdError()

    def get_id_v2(self, objectType, symbol):  # type: ignore
        # type: (unicode, Symbol) -> unicode
        return symbol.get_full_nested_name().get_id_v2()

    def __unicode__(self):
        # type: () -> unicode
        res = text_type(self.nestedName)
        if self.isFunction:
            res += "()"
        if self.initializer:
            res += text_type(self.initializer)
        return res

    def describe_signature(self, signode, mode, env, symbol):
        # type: (addnodes.desc_signature, unicode, BuildEnvironment, Symbol) -> None
        signode += nodes.Text(text_type("bool "))
        self.nestedName.describe_signature(signode, mode, env, symbol)
        if self.isFunction:
            signode += nodes.Text("()")
        if self.initializer:
            self.initializer.describe_signature(signode, mode)


class ASTBaseClass(ASTBase):
    def __init__(self, name, visibility, virtual, pack):
        # type: (Any, unicode, bool, bool) -> None
        self.name = name
        self.visibility = visibility
        self.virtual = virtual
        self.pack = pack

    def __unicode__(self):
        # type: () -> unicode
        res = []  # type: List[unicode]
        if self.visibility != 'private':
            res.append(self.visibility)
            res.append(' ')
        if self.virtual:
            res.append('virtual ')
        res.append(text_type(self.name))
        if self.pack:
            res.append('...')
        return u''.join(res)

    def describe_signature(self, signode, mode, env, symbol):
        # type: (addnodes.desc_signature, unicode, BuildEnvironment, Symbol) -> None
        _verify_description_mode(mode)
        if self.visibility != 'private':
            signode += addnodes.desc_annotation(self.visibility,
                                                self.visibility)
            signode += nodes.Text(' ')
        if self.virtual:
            signode += addnodes.desc_annotation('virtual', 'virtual')
            signode += nodes.Text(' ')
        self.name.describe_signature(signode, 'markType', env, symbol=symbol)
        if self.pack:
            signode += nodes.Text('...')


class ASTClass(ASTBase):
    def __init__(self, name, final, bases):
        # type: (Any, bool, List[Any]) -> None
        self.name = name
        self.final = final
        self.bases = bases

    def get_id_v1(self, objectType, symbol):  # type: ignore
        # type: (unicode, Symbol) -> unicode
        return symbol.get_full_nested_name().get_id_v1()

    def get_id_v2(self, objectType, symbol):  # type: ignore
        # type: (unicode, Symbol) -> unicode
        return symbol.get_full_nested_name().get_id_v2()

    def __unicode__(self):
        # type: () -> unicode
        res = []
        res.append(text_type(self.name))
        if self.final:
            res.append(' final')
        if len(self.bases) > 0:
            res.append(' : ')
            first = True
            for b in self.bases:
                if not first:
                    res.append(', ')
                first = False
                res.append(text_type(b))
        return u''.join(res)

    def describe_signature(self, signode, mode, env, symbol):
        # type: (addnodes.desc_signature, unicode, BuildEnvironment, Symbol) -> None
        _verify_description_mode(mode)
        self.name.describe_signature(signode, mode, env, symbol=symbol)
        if self.final:
            signode += nodes.Text(' ')
            signode += addnodes.desc_annotation('final', 'final')
        if len(self.bases) > 0:
            signode += nodes.Text(' : ')
            for b in self.bases:
                b.describe_signature(signode, mode, env, symbol=symbol)
                signode += nodes.Text(', ')
            signode.pop()


class ASTEnum(ASTBase):
    def __init__(self, name, scoped, underlyingType):
        # type: (Any, unicode, Any) -> None
        self.name = name
        self.scoped = scoped
        self.underlyingType = underlyingType

    def get_id_v1(self, objectType, symbol):  # type: ignore
        # type: (unicode, Symbol) -> unicode
        raise NoOldIdError()

    def get_id_v2(self, objectType, symbol):  # type: ignore
        # type: (unicode, Symbol) -> unicode
        return symbol.get_full_nested_name().get_id_v2()

    def __unicode__(self):
        # type: () -> unicode
        res = []  # type: List[unicode]
        if self.scoped:
            res.append(self.scoped)
            res.append(' ')
        res.append(text_type(self.name))
        if self.underlyingType:
            res.append(' : ')
            res.append(text_type(self.underlyingType))
        return u''.join(res)

    def describe_signature(self, signode, mode, env, symbol):
        # type: (addnodes.desc_signature, unicode, BuildEnvironment, Symbol) -> None
        _verify_description_mode(mode)
        # self.scoped has been done by the CPPEnumObject
        self.name.describe_signature(signode, mode, env, symbol=symbol)
        if self.underlyingType:
            signode += nodes.Text(' : ')
            self.underlyingType.describe_signature(signode, 'noneIsName',
                                                   env, symbol=symbol)


class ASTEnumerator(ASTBase):
    def __init__(self, name, init):
        # type: (Any, Any) -> None
        self.name = name
        self.init = init

    def get_id_v1(self, objectType, symbol):  # type: ignore
        # type: (unicode, Symbol) -> unicode
        raise NoOldIdError()

    def get_id_v2(self, objectType, symbol):  # type: ignore
        # type: (unicode, Symbol) -> unicode
        return symbol.get_full_nested_name().get_id_v2()

    def __unicode__(self):
        # type: () -> unicode
        res = []
        res.append(text_type(self.name))
        if self.init:
            res.append(text_type(self.init))
        return u''.join(res)

    def describe_signature(self, signode, mode, env, symbol):
        # type: (addnodes.desc_signature, unicode, BuildEnvironment, Symbol) -> None
        _verify_description_mode(mode)
        self.name.describe_signature(signode, mode, env, symbol=symbol)
        if self.init:
            self.init.describe_signature(signode, 'noneIsName')


class ASTDeclaration(ASTBase):
    def __init__(self, objectType, visibility, templatePrefix, declaration):
        # type: (unicode, unicode, Any, Any) -> None
        self.objectType = objectType
        self.visibility = visibility
        self.templatePrefix = templatePrefix
        self.declaration = declaration

        self.symbol = None  # type: Symbol
        # set by CPPObject._add_enumerator_to_parent
        self.enumeratorScopedSymbol = None  # type: Any

    def clone(self):
        # type: () -> ASTDeclaration
        if self.templatePrefix:
            templatePrefixClone = self.templatePrefix.clone()
        else:
            templatePrefixClone = None
        return ASTDeclaration(self.objectType, self.visibility,
                              templatePrefixClone,
                              self.declaration.clone())

    @property
    def name(self):
        # type: () -> unicode
        return self.declaration.name

    def get_id_v1(self):
        # type: () -> unicode
        if self.templatePrefix:
            raise NoOldIdError()
        if self.objectType == 'enumerator' and self.enumeratorScopedSymbol:
            return self.enumeratorScopedSymbol.declaration.get_id_v1()
        return self.declaration.get_id_v1(self.objectType, self.symbol)

    def get_id_v2(self, prefixed=True):
        # type: (bool) -> unicode
        if self.objectType == 'enumerator' and self.enumeratorScopedSymbol:
            return self.enumeratorScopedSymbol.declaration.get_id_v2(prefixed)
        if prefixed:
            res = [_id_prefix_v2]
        else:
            res = []
        if self.templatePrefix:
            res.append(self.templatePrefix.get_id_v2())
        res.append(self.declaration.get_id_v2(self.objectType, self.symbol))
        return u''.join(res)

    def get_newest_id(self):
        # type: () -> unicode
        return self.get_id_v2()

    def __unicode__(self):
        # type: () -> unicode
        res = []  # type: List[unicode]
        if self.visibility and self.visibility != "public":
            res.append(self.visibility)
            res.append(u' ')
        if self.templatePrefix:
            res.append(text_type(self.templatePrefix))
        res.append(text_type(self.declaration))
        return u''.join(res)

    def describe_signature(self, signode, mode, env, options):
        # type: (addnodes.desc_signature, unicode, BuildEnvironment, Dict) -> None
        _verify_description_mode(mode)
        # The caller of the domain added a desc_signature node.
        # Always enable multiline:
        signode['is_multiline'] = True
        # Put each line in a desc_signature_line node.
        mainDeclNode = addnodes.desc_signature_line()
        mainDeclNode.sphinx_cpp_tagname = 'declarator'
        mainDeclNode['add_permalink'] = True

        assert self.symbol
        if self.templatePrefix:
            self.templatePrefix.describe_signature(signode, mode, env,
                                                   symbol=self.symbol,
                                                   lineSpec=options.get('tparam-line-spec'))
        signode += mainDeclNode
        if self.visibility and self.visibility != "public":
            mainDeclNode += addnodes.desc_annotation(self.visibility + " ",
                                                     self.visibility + " ")
        if self.objectType == 'type':
            prefix = self.declaration.get_type_declaration_prefix()
            prefix += ' '
            mainDeclNode += addnodes.desc_annotation(prefix, prefix)
        elif self.objectType == 'concept':
            mainDeclNode += addnodes.desc_annotation('concept ', 'concept ')
        elif self.objectType == 'member':
            pass
        elif self.objectType == 'function':
            pass
        elif self.objectType == 'class':
            mainDeclNode += addnodes.desc_annotation('class ', 'class ')
        elif self.objectType == 'enum':
            prefix = 'enum '
            if self.scoped:  # type: ignore
                prefix += self.scoped  # type: ignore
                prefix += ' '
            mainDeclNode += addnodes.desc_annotation(prefix, prefix)
        elif self.objectType == 'enumerator':
            mainDeclNode += addnodes.desc_annotation('enumerator ', 'enumerator ')
        else:
            assert False
        self.declaration.describe_signature(mainDeclNode, mode, env,
                                            symbol=self.symbol)


class ASTNamespace(ASTBase):
    def __init__(self, nestedName, templatePrefix):
        # type: (Any, Any) -> None
        self.nestedName = nestedName
        self.templatePrefix = templatePrefix


class Symbol(object):
    def _assert_invariants(self):
        # type: () -> None
        if not self.parent:
            # parent == None means global scope, so declaration means a parent
            assert not self.identifier
            assert not self.templateParams
            assert not self.templateArgs
            assert not self.declaration
            assert not self.docname
        else:
            if not self.identifier:
                # in case it's an operator
                assert self.declaration
            if self.declaration:
                assert self.docname

    def __init__(self, parent, identifier,
                 templateParams, templateArgs, declaration, docname):
        # type: (Any, Any, Any, Any, Any, unicode) -> None
        self.parent = parent
        self.identifier = identifier
        self.templateParams = templateParams  # template<templateParams>
        self.templateArgs = templateArgs  # identifier<templateArgs>
        self.declaration = declaration
        self.docname = docname
        self._assert_invariants()

        self.children = []  # type: List[Any]
        if self.parent:
            self.parent.children.append(self)
        if self.declaration:
            self.declaration.symbol = self
        # add symbols for the template params
        # (do it after self.children has been initialised
        if self.templateParams:
            for p in self.templateParams.params:
                if not p.get_identifier():
                    continue
                # only add a declaration if we our selfs from a declaration
                if declaration:
                    decl = ASTDeclaration('templateParam', None, None, p)
                else:
                    decl = None
                nne = ASTNestedNameElement(p.get_identifier(), None)
                nn = ASTNestedName([nne], rooted=False)
                self._add_symbols(nn, [], decl, docname)

    def _fill_empty(self, declaration, docname):
        # type: (Any, unicode) -> None
        self._assert_invariants()
        assert not self.declaration
        assert not self.docname
        assert declaration
        assert docname
        self.declaration = declaration
        self.declaration.symbol = self
        self.docname = docname
        self._assert_invariants()

    def clear_doc(self, docname):
        # type: (unicode) -> None
        newChildren = []
        for sChild in self.children:
            sChild.clear_doc(docname)
            if sChild.declaration and sChild.docname == docname:
                sChild.declaration = None
                sChild.docname = None
            # Just remove operators, because there is no identification if
            # they got removed.
            # Don't remove other symbols because they may be used in namespace
            # directives.
            if sChild.identifier or sChild.declaration:
                newChildren.append(sChild)
        self.children = newChildren

    def get_all_symbols(self):
        # type: () -> Iterator[Any]
        yield self
        for sChild in self.children:
            for s in sChild.get_all_symbols():
                yield s

    def get_lookup_key(self):
        # type: () -> List[Tuple[ASTNestedNameElement, Any]]
        if not self.parent:
            # specialise for the root
            return None
        symbols = []
        s = self
        while s.parent:
            symbols.append(s)
            s = s.parent
        symbols.reverse()
        key = []
        for s in symbols:
            if s.identifier:
                nne = ASTNestedNameElement(s.identifier, s.templateArgs)
            else:
                assert s.declaration
                nne = s.declaration.name.names[-1]
            key.append((nne, s.templateParams))
        return key

    def get_full_nested_name(self):
        # type: () -> ASTNestedName
        names = []
        for nne, templateParams in self.get_lookup_key():
            names.append(nne)
        return ASTNestedName(names, rooted=False)

    def _find_named_symbol(self, identifier, templateParams,
                           templateArgs, operator,
                           templateShorthand, matchSelf):
        # type: (Any, Any, Any, Any, Any, bool) -> Symbol
        assert (identifier is None) != (operator is None)

        def matches(s):
            if s.identifier != identifier:
                return False
            if not s.identifier:
                if not s.declaration:
                    return False
                assert operator
                name = s.declaration.name.names[-1]
                if not name.is_operator():
                    return False
                if text_type(name) != text_type(operator):
                    return False
            if (s.templateParams is None) != (templateParams is None):
                if templateParams is not None:
                    # we query with params, they must match params
                    return False
                if not templateShorthand:
                    # we don't query with params, and we do care about them
                    return False
            if templateParams:
                # TODO: do better comparison
                if text_type(s.templateParams) != text_type(templateParams):
                    return False
            if (s.templateArgs is None) != (templateArgs is None):
                return False
            if s.templateArgs:
                # TODO: do better comparison
                if text_type(s.templateArgs) != text_type(templateArgs):
                    return False
            return True
        if matchSelf and matches(self):
            return self
        for s in self.children:
            if matches(s):
                return s
        return None

    def _add_symbols(self, nestedName, templateDecls, declaration, docname):
        # type: (Any, List[Any], Any, unicode) -> Symbol
        # This condition should be checked at the parser level.
        # Each template argument list must have a template parameter list.
        # But to declare a template there must be an additional template parameter list.
        assert(nestedName.num_templates() == len(templateDecls) or
               nestedName.num_templates() + 1 == len(templateDecls))

        parentSymbol = self
        if nestedName.rooted:
            while parentSymbol.parent:
                parentSymbol = parentSymbol.parent
        names = nestedName.names
        iTemplateDecl = 0
        for name in names[:-1]:
            # there shouldn't be anything inside an operator
            # (other than template parameters, which are not added this way, right?)
            assert not name.is_operator()
            identifier = name.identifier
            templateArgs = name.templateArgs
            if templateArgs:
                assert iTemplateDecl < len(templateDecls)
                templateParams = templateDecls[iTemplateDecl]
                iTemplateDecl += 1
            else:
                templateParams = None
            symbol = parentSymbol._find_named_symbol(identifier,
                                                     templateParams,
                                                     templateArgs,
                                                     operator=None,
                                                     templateShorthand=False,
                                                     matchSelf=False)
            if symbol is None:
                symbol = Symbol(parent=parentSymbol, identifier=identifier,
                                templateParams=templateParams,
                                templateArgs=templateArgs, declaration=None,
                                docname=None)
            parentSymbol = symbol
        name = names[-1]
        if name.is_operator():
            identifier = None
            templateArgs = None
            operator = name
        else:
            identifier = name.identifier
            templateArgs = name.templateArgs
            operator = None
        if iTemplateDecl < len(templateDecls):
            if iTemplateDecl + 1 != len(templateDecls):
                print(text_type(templateDecls))
                print(text_type(nestedName))
            assert iTemplateDecl + 1 == len(templateDecls)
            templateParams = templateDecls[iTemplateDecl]
        else:
            assert iTemplateDecl == len(templateDecls)
            templateParams = None
        symbol = parentSymbol._find_named_symbol(identifier,
                                                 templateParams,
                                                 templateArgs,
                                                 operator,
                                                 templateShorthand=False,
                                                 matchSelf=False)
        if symbol:
            if not declaration:
                # good, just a scope creation
                return symbol
            if not symbol.declaration:
                # If someone first opened the scope, and then later
                # declares it, e.g,
                # .. namespace:: Test
                # .. namespace:: nullptr
                # .. class:: Test
                symbol._fill_empty(declaration, docname)
                return symbol
            # It may simply be a functin overload, so let's compare ids.
            candSymbol = Symbol(parent=parentSymbol, identifier=identifier,
                                templateParams=templateParams,
                                templateArgs=templateArgs,
                                declaration=declaration,
                                docname=docname)
            newId = declaration.get_newest_id()
            oldId = symbol.declaration.get_newest_id()
            if newId != oldId:
                # we already inserted the symbol, so return the new one
                symbol = candSymbol
            else:
                # Redeclaration of the same symbol.
                # Let the new one be there, but raise an error to the client
                # so it can use the real symbol as subscope.
                # This will probably result in a duplicate id warning.
                raise _DuplicateSymbolError(symbol, candSymbol)
        else:
            symbol = Symbol(parent=parentSymbol, identifier=identifier,
                            templateParams=templateParams,
                            templateArgs=templateArgs,
                            declaration=declaration,
                            docname=docname)
        return symbol

    def merge_with(self, other, docnames, env):
        # type: (Any, List[unicode], BuildEnvironment) -> None
        assert other is not None
        for otherChild in other.children:
            if not otherChild.identifier:
                if not otherChild.declaration:
                    print("Problem in symbol tree merging")
                    print("OtherChild.dump:")
                    print(otherChild.dump(0))
                    print("Other.dump:")
                    print(other.dump(0))
                assert otherChild.declaration
                operator = otherChild.declaration.name.names[-1]
                assert operator.is_operator()
            else:
                operator = None
            ourChild = self._find_named_symbol(otherChild.identifier,
                                               otherChild.templateParams,
                                               otherChild.templateArgs,
                                               operator,
                                               templateShorthand=False,
                                               matchSelf=False)
            if ourChild is None:
                # TODO: hmm, should we prune by docnames?
                self.children.append(otherChild)
                otherChild.parent = self
                otherChild._assert_invariants()
                continue
            if otherChild.declaration and otherChild.docname in docnames:
                if not ourChild.declaration:
                    ourChild._fill_empty(otherChild.declaration, otherChild.docname)
                elif ourChild.docname != otherChild.docname:
                    name = text_type(ourChild.declaration)
                    msg = "Duplicate declaration, also defined in '%s'.\n"
                    msg += "Declaration is '%s'."
                    msg = msg % (ourChild.docname, name)
                    logger.warning(msg, location=otherChild.docname)
                else:
                    # Both have declarations, and in the same docname.
                    # This can apparently happen, it should be safe to
                    # just ignore it, right?
                    pass
            ourChild.merge_with(otherChild, docnames, env)

    def add_name(self, nestedName, templatePrefix=None):
        # type: (unicode, Any) -> Symbol
        if templatePrefix:
            templateDecls = templatePrefix.templates
        else:
            templateDecls = []
        return self._add_symbols(nestedName, templateDecls,
                                 declaration=None, docname=None)

    def add_declaration(self, declaration, docname):
        # type: (Any, unicode) -> Symbol
        assert declaration
        assert docname
        nestedName = declaration.name
        if declaration.templatePrefix:
            templateDecls = declaration.templatePrefix.templates
        else:
            templateDecls = []
        return self._add_symbols(nestedName, templateDecls, declaration, docname)

    def find_identifier(self, identifier, matchSelf):
        # type: (Any, bool) -> Symbol
        if matchSelf and self.identifier and self.identifier == identifier:
            return self
        for s in self.children:
            if s.identifier and s.identifier == identifier:
                return s
        return None

    def direct_lookup(self, key):
        # type: (List[Tuple[Any, Any]]) -> Symbol
        s = self
        for name, templateParams in key:
            if name.is_operator():
                identifier = None
                templateArgs = None
                operator = name
            else:
                identifier = name.identifier
                templateArgs = name.templateArgs
                operator = None
            s = s._find_named_symbol(identifier, templateParams,
                                     templateArgs, operator,
                                     templateShorthand=False,
                                     matchSelf=False)
            if not s:
                return None
        return s

    def find_name(self, nestedName, templateDecls, templateShorthand, matchSelf):
        # type: (Any, Any, Any, bool) -> Symbol
        # templateShorthand: missing template parameter lists for templates is ok

        # TODO: unify this with the _add_symbols
        # This condition should be checked at the parser level.
        assert len(templateDecls) <= nestedName.num_templates() + 1
        parentSymbol = self
        if nestedName.rooted:
            while parentSymbol.parent:
                parentSymbol = parentSymbol.parent
        names = nestedName.names

        # walk up until we find the first identifier
        firstName = names[0]
        if not firstName.is_operator():
            while parentSymbol.parent:
                if parentSymbol.find_identifier(firstName.identifier,
                                                matchSelf=matchSelf):
                    break
                parentSymbol = parentSymbol.parent

        iTemplateDecl = 0
        for iName in range(len(names)):
            name = names[iName]
            if iName + 1 == len(names):
                if name.is_operator():
                    identifier = None
                    templateArgs = None
                    operator = name
                else:
                    identifier = name.identifier
                    templateArgs = name.templateArgs
                    operator = None
                if iTemplateDecl < len(templateDecls):
                    assert iTemplateDecl + 1 == len(templateDecls)
                    templateParams = templateDecls[iTemplateDecl]
                else:
                    assert iTemplateDecl == len(templateDecls)
                    templateParams = None
                symbol = parentSymbol._find_named_symbol(identifier,
                                                         templateParams,
                                                         templateArgs,
                                                         operator,
                                                         templateShorthand=templateShorthand,
                                                         matchSelf=matchSelf)
                if symbol:
                    return symbol
                else:
                    return None
            else:
                # there shouldn't be anything inside an operator
                assert not name.is_operator()
                identifier = name.identifier
                templateArgs = name.templateArgs
                if templateArgs and iTemplateDecl < len(templateDecls):
                    templateParams = templateDecls[iTemplateDecl]
                    iTemplateDecl += 1
                else:
                    templateParams = None
                symbol = parentSymbol._find_named_symbol(identifier,
                                                         templateParams,
                                                         templateArgs,
                                                         operator=None,
                                                         templateShorthand=templateShorthand,
                                                         matchSelf=matchSelf)
                if symbol is None:
                    # TODO: maybe search without template args
                    return None
                # We have now matched part of a nested name, and need to match more
                # so even if we should matchSelf before, we definitely shouldn't
                # even more. (see also issue #2666)
                matchSelf = False
            parentSymbol = symbol
        assert False  # should have returned in the loop

    def to_string(self, indent):
        # type: (int) -> unicode
        res = ['\t' * indent]  # type: List[unicode]
        if not self.parent:
            res.append('::')
        else:
            if self.templateParams:
                res.append(text_type(self.templateParams))
                res.append('\n')
                res.append('\t' * indent)
            if self.identifier:
                res.append(text_type(self.identifier))
            else:
                res.append(text_type(self.declaration))
            if self.templateArgs:
                res.append(text_type(self.templateArgs))
            if self.declaration:
                res.append(": ")
                res.append(text_type(self.declaration))
        if self.docname:
            res.append('\t(')
            res.append(self.docname)
            res.append(')')
        res.append('\n')
        return ''.join(res)

    def dump(self, indent):
        # type: (int) -> unicode
        res = [self.to_string(indent)]
        for c in self.children:
            res.append(c.dump(indent + 1))
        return ''.join(res)


class DefinitionParser(object):
    # those without signedness and size modifiers
    # see http://en.cppreference.com/w/cpp/language/types
    _simple_fundemental_types = (
        'void', 'bool', 'char', 'wchar_t', 'char16_t', 'char32_t', 'int',
        'float', 'double', 'auto'
    )

    _prefix_keys = ('class', 'struct', 'enum', 'union', 'typename')

    def __init__(self, definition, warnEnv, config):
        # type: (Any, Any, Config) -> None
        self.definition = definition.strip()
        self.pos = 0
        self.end = len(self.definition)
        self.last_match = None  # type: Match
        self._previous_state = (0, None)  # type: Tuple[int, Match]

        self.warnEnv = warnEnv
        self.config = config

    def _make_multi_error(self, errors, header):
        # type: (List[Any], unicode) -> DefinitionError
        if len(errors) == 1:
            return DefinitionError(header + '\n' + errors[0][0].description)
        result = [header, '\n']
        for e in errors:
            if len(e[1]) > 0:
                ident = '  '
                result.append(e[1])
                result.append(':\n')
                for line in e[0].description.split('\n'):
                    if len(line) == 0:
                        continue
                    result.append(ident)
                    result.append(line)
                    result.append('\n')
            else:
                result.append(e[0].description)
        return DefinitionError(''.join(result))

    def status(self, msg):
        # type: (unicode) -> None
        # for debugging
        indicator = '-' * self.pos + '^'
        print("%s\n%s\n%s" % (msg, self.definition, indicator))

    def fail(self, msg):
        # type: (unicode) -> None
        indicator = '-' * self.pos + '^'
        raise DefinitionError(
            'Invalid definition: %s [error at %d]\n  %s\n  %s' %
            (msg, self.pos, self.definition, indicator))

    def warn(self, msg):
        # type: (unicode) -> None
        if self.warnEnv:
            self.warnEnv.warn(msg)
        else:
            print("Warning: %s" % msg)

    def match(self, regex):
        # type: (Pattern) -> bool
        match = regex.match(self.definition, self.pos)
        if match is not None:
            self._previous_state = (self.pos, self.last_match)
            self.pos = match.end()
            self.last_match = match
            return True
        return False

    def backout(self):
        # type: () -> None
        self.pos, self.last_match = self._previous_state

    def skip_string(self, string):
        # type: (unicode) -> bool
        strlen = len(string)
        if self.definition[self.pos:self.pos + strlen] == string:
            self.pos += strlen
            return True
        return False

    def skip_word(self, word):
        # type: (unicode) -> bool
        return self.match(re.compile(r'\b%s\b' % re.escape(word)))

    def skip_ws(self):
        # type: () -> bool
        return self.match(_whitespace_re)

    def skip_word_and_ws(self, word):
        # type: (unicode) -> bool
        if self.skip_word(word):
            self.skip_ws()
            return True
        return False

    def skip_string_and_ws(self, string):
        # type: (unicode) -> bool
        if self.skip_string(string):
            self.skip_ws()
            return True
        return False

    @property
    def eof(self):
        # type: () -> bool
        return self.pos >= self.end

    @property
    def current_char(self):
        # type: () -> unicode
        try:
            return self.definition[self.pos]
        except IndexError:
            return 'EOF'

    @property
    def matched_text(self):
        # type: () -> unicode
        if self.last_match is not None:
            return self.last_match.group()
        else:
            return None

    def read_rest(self):
        # type: () -> unicode
        rv = self.definition[self.pos:]
        self.pos = self.end
        return rv

    def assert_end(self):
        # type: () -> None
        self.skip_ws()
        if not self.eof:
            self.fail('Expected end of definition.')

    def _parse_balanced_token_seq(self, end):
        # type: (List[unicode]) -> unicode
        # TODO: add handling of string literals and similar
        brackets = {'(': ')', '[': ']', '{': '}'}  # type: Dict[unicode, unicode]
        startPos = self.pos
        symbols = []  # type: List[unicode]
        while not self.eof:
            if len(symbols) == 0 and self.current_char in end:
                break
            if self.current_char in brackets.keys():
                symbols.append(brackets[self.current_char])
            elif len(symbols) > 0 and self.current_char == symbols[-1]:
                symbols.pop()
            elif self.current_char in ")]}":
                self.fail("Unexpected '%s' in balanced-token-seq." % self.current_char)
            self.pos += 1
        if self.eof:
            self.fail("Could not find end of balanced-token-seq starting at %d."
                      % startPos)
        return self.definition[startPos:self.pos]

    def _parse_attribute(self):
        # type: () -> Any
        self.skip_ws()
        # try C++11 style
        startPos = self.pos
        if self.skip_string_and_ws('['):
            if not self.skip_string('['):
                self.pos = startPos
            else:
                # TODO: actually implement the correct grammar
                arg = self._parse_balanced_token_seq(end=[']'])
                if not self.skip_string_and_ws(']'):
                    self.fail("Expected ']' in end of attribute.")
                if not self.skip_string_and_ws(']'):
                    self.fail("Expected ']' in end of attribute after [[...]")
                return ASTCPPAttribute(arg)

        # try GNU style
        if self.skip_word_and_ws('__attribute__'):
            if not self.skip_string_and_ws('('):
                self.fail("Expected '(' after '__attribute__'.")
            if not self.skip_string_and_ws('('):
                self.fail("Expected '(' after '__attribute__('.")
            attrs = []
            while 1:
                if self.match(_identifier_re):
                    name = self.matched_text
                    self.skip_ws()
                    if self.skip_string_and_ws('('):
                        self.fail('Parameterized GNU style attribute not yet supported.')
                    attrs.append(ASTGnuAttribute(name, None))
                    # TODO: parse arguments for the attribute
                if self.skip_string_and_ws(','):
                    continue
                elif self.skip_string_and_ws(')'):
                    break
                else:
                    self.fail("Expected identifier, ')', or ',' in __attribute__.")
            if not self.skip_string_and_ws(')'):
                self.fail("Expected ')' after '__attribute__((...)'")
            return ASTGnuAttributeList(attrs)

        # try the simple id attributes defined by the user
        for id in self.config.cpp_id_attributes:
            if self.skip_word_and_ws(id):
                return ASTIdAttribute(id)

        # try the paren attributes defined by the user
        for id in self.config.cpp_paren_attributes:
            if not self.skip_string_and_ws(id):
                continue
            if not self.skip_string('('):
                self.fail("Expected '(' after user-defined paren-attribute.")
            arg = self._parse_balanced_token_seq(end=[')'])
            if not self.skip_string(')'):
                self.fail("Expected ')' to end user-defined paren-attribute.")
            return ASTParenAttribute(id, arg)

        return None

    def _parse_expression(self, end):
        # type: (List[unicode]) -> unicode
        # Stupidly "parse" an expression.
        # 'end' should be a list of characters which ends the expression.
        assert end
        self.skip_ws()
        startPos = self.pos
        if self.match(_string_re):
            value = self.matched_text
        else:
            # TODO: add handling of more bracket-like things, and quote handling
            brackets = {'(': ')', '[': ']', '<': '>'}  # type: Dict[unicode, unicode]
            symbols = []  # type: List[unicode]
            while not self.eof:
                if (len(symbols) == 0 and self.current_char in end):
                    break
                if self.current_char in brackets.keys():
                    symbols.append(brackets[self.current_char])
                elif len(symbols) > 0 and self.current_char == symbols[-1]:
                    symbols.pop()
                self.pos += 1
            if self.eof:
                self.fail("Could not find end of expression starting at %d."
                          % startPos)
            value = self.definition[startPos:self.pos].strip()
        return value.strip()

    def _parse_operator(self):
        # type: () -> Any
        self.skip_ws()
        # adapted from the old code
        # thank god, a regular operator definition
        if self.match(_operator_re):
            return ASTOperatorBuildIn(self.matched_text)

        # new/delete operator?
        for op in 'new', 'delete':
            if not self.skip_word(op):
                continue
            self.skip_ws()
            if self.skip_string('['):
                self.skip_ws()
                if not self.skip_string(']'):
                    self.fail('Expected "]" after  "operator ' + op + '["')
                op += '[]'
            return ASTOperatorBuildIn(op)

        # user-defined literal?
        if self.skip_string('""'):
            self.skip_ws()
            if not self.match(_identifier_re):
                self.fail("Expected user-defined literal suffix.")
            identifier = ASTIdentifier(self.matched_text)
            return ASTOperatorLiteral(identifier)

        # oh well, looks like a cast operator definition.
        # In that case, eat another type.
        type = self._parse_type(named=False, outer="operatorCast")
        return ASTOperatorType(type)

    def _parse_template_argument_list(self):
        # type: () -> ASTTemplateArgs
        self.skip_ws()
        if not self.skip_string('<'):
            return None
        prevErrors = []
        templateArgs = []  # type: List
        while 1:
            pos = self.pos
            parsedComma = False
            parsedEnd = False
            try:
                type = self._parse_type(named=False)
                self.skip_ws()
                if self.skip_string('>'):
                    parsedEnd = True
                elif self.skip_string(','):
                    parsedComma = True
                else:
                    self.fail('Expected ">" or "," in template argument list.')
                templateArgs.append(type)
            except DefinitionError as e:
                prevErrors.append((e, "If type argument"))
                self.pos = pos
                try:
                    value = self._parse_expression(end=[',', '>'])
                    self.skip_ws()
                    if self.skip_string('>'):
                        parsedEnd = True
                    elif self.skip_string(','):
                        parsedComma = True
                    else:
                        self.fail('Expected ">" or "," in template argument list.')
                    templateArgs.append(ASTTemplateArgConstant(value))
                except DefinitionError as e:
                    self.pos = pos
                    prevErrors.append((e, "If non-type argument"))
                    header = "Error in parsing template argument list."
                    raise self._make_multi_error(prevErrors, header)
            if parsedEnd:
                assert not parsedComma
                break
        return ASTTemplateArgs(templateArgs)

    def _parse_nested_name(self, memberPointer=False):
        # type: (bool) -> ASTNestedName
        names = []

        self.skip_ws()
        rooted = False
        if self.skip_string('::'):
            rooted = True
        while 1:
            self.skip_ws()
            if self.skip_word_and_ws('template'):
                self.fail("'template' in nested name not implemented.")
            elif self.skip_word_and_ws('operator'):
                op = self._parse_operator()
                names.append(op)
            else:
                if not self.match(_identifier_re):
                    if memberPointer and len(names) > 0:
                        break
                    self.fail("Expected identifier in nested name.")
                identifier = self.matched_text
                # make sure there isn't a keyword
                if identifier in _keywords:
                    self.fail("Expected identifier in nested name, "
                              "got keyword: %s" % identifier)
                templateArgs = self._parse_template_argument_list()
                identifier = ASTIdentifier(identifier)  # type: ignore
                names.append(ASTNestedNameElement(identifier, templateArgs))

            self.skip_ws()
            if not self.skip_string('::'):
                if memberPointer:
                    self.fail("Expected '::' in pointer to member (function).")
                break
        return ASTNestedName(names, rooted)

    def _parse_trailing_type_spec(self):
        # type: () -> Any
        # fundemental types
        self.skip_ws()
        for t in self._simple_fundemental_types:
            if self.skip_word(t):
                return ASTTrailingTypeSpecFundamental(t)

        # TODO: this could/should be more strict
        elements = []
        if self.skip_word_and_ws('signed'):
            elements.append('signed')
        elif self.skip_word_and_ws('unsigned'):
            elements.append('unsigned')
        while 1:
            if self.skip_word_and_ws('short'):
                elements.append('short')
            elif self.skip_word_and_ws('long'):
                elements.append('long')
            else:
                break
        if self.skip_word_and_ws('char'):
            elements.append('char')
        elif self.skip_word_and_ws('int'):
            elements.append('int')
        elif self.skip_word_and_ws('double'):
            elements.append('double')
        if len(elements) > 0:
            return ASTTrailingTypeSpecFundamental(u' '.join(elements))

        # decltype
        self.skip_ws()
        if self.skip_word_and_ws('decltype'):
            self.fail('"decltype(.)" in trailing_type_spec not implemented')

        # prefixed
        prefix = None
        self.skip_ws()
        for k in self._prefix_keys:
            if self.skip_word_and_ws(k):
                prefix = k
                break

        nestedName = self._parse_nested_name()
        return ASTTrailingTypeSpecName(prefix, nestedName)

    def _parse_parameters_and_qualifiers(self, paramMode):
        # type: (unicode) -> ASTParametersQualifiers
        self.skip_ws()
        if not self.skip_string('('):
            if paramMode == 'function':
                self.fail('Expecting "(" in parameters_and_qualifiers.')
            else:
                return None
        args = []
        self.skip_ws()
        if not self.skip_string(')'):
            while 1:
                self.skip_ws()
                if self.skip_string('...'):
                    args.append(ASTFunctionParameter(None, True))
                    self.skip_ws()
                    if not self.skip_string(')'):
                        self.fail('Expected ")" after "..." in '
                                  'parameters_and_qualifiers.')
                    break
                # note: it seems that function arguments can always sbe named,
                # even in function pointers and similar.
                arg = self._parse_type_with_init(outer=None, named='single')
                # TODO: parse default parameters # TODO: didn't we just do that?
                args.append(ASTFunctionParameter(arg))

                self.skip_ws()
                if self.skip_string(','):
                    continue
                elif self.skip_string(')'):
                    break
                else:
                    self.fail(
                        'Expecting "," or ")" in parameters_and_qualifiers, '
                        'got "%s".' % self.current_char)

        # TODO: why did we have this bail-out?
        # does it hurt to parse the extra stuff?
        # it's needed for pointer to member functions
        if paramMode != 'function' and False:
            return ASTParametersQualifiers(
                args, None, None, None, None, None, None, None)

        self.skip_ws()
        const = self.skip_word_and_ws('const')
        volatile = self.skip_word_and_ws('volatile')
        if not const:  # the can be permuted
            const = self.skip_word_and_ws('const')

        refQual = None
        if self.skip_string('&&'):
            refQual = '&&'
        if not refQual and self.skip_string('&'):
            refQual = '&'

        exceptionSpec = None
        override = None
        final = None
        initializer = None
        self.skip_ws()
        if self.skip_string('noexcept'):
            exceptionSpec = 'noexcept'
            self.skip_ws()
            if self.skip_string('('):
                self.fail('Parameterised "noexcept" not implemented.')

        self.skip_ws()
        override = self.skip_word_and_ws('override')
        final = self.skip_word_and_ws('final')
        if not override:
            override = self.skip_word_and_ws(
                'override')  # they can be permuted

        self.skip_ws()
        if self.skip_string('='):
            self.skip_ws()
            valid = ('0', 'delete', 'default')
            for w in valid:
                if self.skip_word_and_ws(w):
                    initializer = w
                    break
            if not initializer:
                self.fail(
                    'Expected "%s" in initializer-specifier.'
                    % u'" or "'.join(valid))

        return ASTParametersQualifiers(
            args, volatile, const, refQual, exceptionSpec, override, final,
            initializer)

    def _parse_decl_specs_simple(self, outer, typed):
        # type: (unicode, bool) -> ASTDeclSpecsSimple
        """Just parse the simple ones."""
        storage = None
        threadLocal = None
        inline = None
        virtual = None
        explicit = None
        constexpr = None
        volatile = None
        const = None
        friend = None
        attrs = []
        while 1:  # accept any permutation of a subset of some decl-specs
            self.skip_ws()
            if not storage:
                if outer in ('member', 'function'):
                    if self.skip_word('static'):
                        storage = 'static'
                        continue
                    if self.skip_word('extern'):
                        storage = 'extern'
                        continue
                if outer == 'member':
                    if self.skip_word('mutable'):
                        storage = 'mutable'
                        continue
                if self.skip_word('register'):
                    storage = 'register'
                    continue
            if not threadLocal and outer == 'member':
                threadLocal = self.skip_word('thread_local')
                if threadLocal:
                    continue

            if outer == 'function':
                # function-specifiers
                if not inline:
                    inline = self.skip_word('inline')
                    if inline:
                        continue
                if not friend:
                    friend = self.skip_word('friend')
                    if friend:
                        continue
                if not virtual:
                    virtual = self.skip_word('virtual')
                    if virtual:
                        continue
                if not explicit:
                    explicit = self.skip_word('explicit')
                    if explicit:
                        continue

            if not constexpr and outer in ('member', 'function'):
                constexpr = self.skip_word("constexpr")
                if constexpr:
                    continue
            if not volatile and typed:
                volatile = self.skip_word('volatile')
                if volatile:
                    continue
            if not const and typed:
                const = self.skip_word('const')
                if const:
                    continue
            attr = self._parse_attribute()
            if attr:
                attrs.append(attr)
                continue
            break
        return ASTDeclSpecsSimple(storage, threadLocal, inline, virtual,
                                  explicit, constexpr, volatile, const,
                                  friend, attrs)

    def _parse_decl_specs(self, outer, typed=True):
        # type: (unicode, bool) -> ASTDeclSpecs
        if outer:
            if outer not in ('type', 'member', 'function', 'templateParam'):
                raise Exception('Internal error, unknown outer "%s".' % outer)
        """
        storage-class-specifier function-specifier "constexpr"
        "volatile" "const" trailing-type-specifier

        storage-class-specifier ->
              "static" (only for member_object and function_object)
            | "register"

        function-specifier -> "inline" | "virtual" | "explicit" (only for
        function_object)

        "constexpr" (only for member_object and function_object)
        """
        leftSpecs = self._parse_decl_specs_simple(outer, typed)
        rightSpecs = None

        if typed:
            trailing = self._parse_trailing_type_spec()
            rightSpecs = self._parse_decl_specs_simple(outer, typed)
        else:
            trailing = None
        return ASTDeclSpecs(outer, leftSpecs, rightSpecs, trailing)

    def _parse_declarator_name_param_qual(self, named, paramMode, typed):
        # type: (Union[bool, unicode], unicode, bool) -> ASTDeclaratorNameParamQual
        # now we should parse the name, and then suffixes
        if named == 'maybe':
            pos = self.pos
            try:
                declId = self._parse_nested_name()
            except DefinitionError:
                self.pos = pos
                declId = None
        elif named == 'single':
            if self.match(_identifier_re):
                identifier = ASTIdentifier(self.matched_text)
                nne = ASTNestedNameElement(identifier, None)
                declId = ASTNestedName([nne], rooted=False)
                # if it's a member pointer, we may have '::', which should be an error
                self.skip_ws()
                if self.current_char == ':':
                    self.fail("Unexpected ':' after identifier.")
            else:
                declId = None
        elif named:
            declId = self._parse_nested_name()
        else:
            declId = None
        arrayOps = []
        while 1:
            self.skip_ws()
            if typed and self.skip_string('['):
                value = self._parse_expression(end=[']'])
                res = self.skip_string(']')
                assert res
                arrayOps.append(ASTArray(value))
                continue
            else:
                break
        paramQual = self._parse_parameters_and_qualifiers(paramMode)
        return ASTDeclaratorNameParamQual(declId=declId, arrayOps=arrayOps,
                                          paramQual=paramQual)

    def _parse_declarator(self, named, paramMode, typed=True):
        # type: (Union[bool, unicode], unicode, bool) -> Any
        # 'typed' here means 'parse return type stuff'
        if paramMode not in ('type', 'function', 'operatorCast'):
            raise Exception(
                "Internal error, unknown paramMode '%s'." % paramMode)
        prevErrors = []
        self.skip_ws()
        if typed and self.skip_string('*'):
            self.skip_ws()
            volatile = False
            const = False
            while 1:
                if not volatile:
                    volatile = self.skip_word_and_ws('volatile')
                    if volatile:
                        continue
                if not const:
                    const = self.skip_word_and_ws('const')
                    if const:
                        continue
                break
            next = self._parse_declarator(named, paramMode, typed)
            return ASTDeclaratorPtr(next=next, volatile=volatile, const=const)
        # TODO: shouldn't we parse an R-value ref here first?
        if typed and self.skip_string("&"):
            next = self._parse_declarator(named, paramMode, typed)
            return ASTDeclaratorRef(next=next)
        if typed and self.skip_string("..."):
            next = self._parse_declarator(named, paramMode, False)
            return ASTDeclaratorParamPack(next=next)
        if typed:  # pointer to member
            pos = self.pos
            try:
                name = self._parse_nested_name(memberPointer=True)
                self.skip_ws()
                if not self.skip_string('*'):
                    self.fail("Expected '*' in pointer to member declarator.")
                self.skip_ws()
            except DefinitionError as e:
                self.pos = pos
                prevErrors.append((e, "If pointer to member declarator"))
            else:
                volatile = False
                const = False
                while 1:
                    if not volatile:
                        volatile = self.skip_word_and_ws('volatile')
                        if volatile:
                            continue
                    if not const:
                        const = self.skip_word_and_ws('const')
                        if const:
                            continue
                    break
                next = self._parse_declarator(named, paramMode, typed)
                return ASTDeclaratorMemPtr(name, const, volatile, next=next)
        if typed and self.current_char == '(':  # note: peeking, not skipping
            if paramMode == "operatorCast":
                # TODO: we should be able to parse cast operators which return
                # function pointers. For now, just hax it and ignore.
                return ASTDeclaratorNameParamQual(declId=None, arrayOps=[],
                                                  paramQual=None)
            # maybe this is the beginning of params and quals,try that first,
            # otherwise assume it's noptr->declarator > ( ptr-declarator )
            pos = self.pos
            try:
                # assume this is params and quals
                res = self._parse_declarator_name_param_qual(named, paramMode,
                                                             typed)
                return res
            except DefinitionError as exParamQual:
                prevErrors.append((exParamQual, "If declId, parameters, and qualifiers"))
                self.pos = pos
                try:
                    assert self.current_char == '('
                    self.skip_string('(')
                    # TODO: hmm, if there is a name, it must be in inner, right?
                    # TODO: hmm, if there must be parameters, they must b
                    # inside, right?
                    inner = self._parse_declarator(named, paramMode, typed)
                    if not self.skip_string(')'):
                        self.fail("Expected ')' in \"( ptr-declarator )\"")
                    next = self._parse_declarator(named=False,
                                                  paramMode="type",
                                                  typed=typed)
                    return ASTDeclaratorParen(inner=inner, next=next)
                except DefinitionError as exNoPtrParen:
                    self.pos = pos
                    prevErrors.append((exNoPtrParen, "If parenthesis in noptr-declarator"))
                    header = "Error in declarator"
                    raise self._make_multi_error(prevErrors, header)
        pos = self.pos
        try:
            return self._parse_declarator_name_param_qual(named, paramMode, typed)
        except DefinitionError as e:
            self.pos = pos
            prevErrors.append((e, "If declarator-id"))
            header = "Error in declarator or parameters and qualifiers"
            raise self._make_multi_error(prevErrors, header)

    def _parse_initializer(self, outer=None):
        # type: (unicode) -> ASTInitializer
        self.skip_ws()
        # TODO: support paren and brace initialization for memberObject
        if not self.skip_string('='):
            return None
        else:
            if outer == 'member':
                value = self.read_rest().strip()  # type: unicode
            elif outer == 'templateParam':
                value = self._parse_expression(end=[',', '>'])
            elif outer is None:  # function parameter
                value = self._parse_expression(end=[',', ')'])
            else:
                self.fail("Internal error, initializer for outer '%s' not "
                          "implemented." % outer)
            return ASTInitializer(value)

    def _parse_type(self, named, outer=None):
        # type: (Union[bool, unicode], unicode) -> ASTType
        """
        named=False|'maybe'|True: 'maybe' is e.g., for function objects which
        doesn't need to name the arguments

        outer == operatorCast: annoying case, we should not take the params
        """
        if outer:  # always named
            if outer not in ('type', 'member', 'function',
                             'operatorCast', 'templateParam'):
                raise Exception('Internal error, unknown outer "%s".' % outer)
            if outer != 'operatorCast':
                assert named

        if outer in ('type', 'function'):
            # We allow type objects to just be a name.
            # Some functions don't have normal return types: constructors,
            # destrutors, cast operators
            prevErrors = []
            startPos = self.pos
            # first try without the type
            try:
                declSpecs = self._parse_decl_specs(outer=outer, typed=False)
                decl = self._parse_declarator(named=True, paramMode=outer,
                                              typed=False)
                self.assert_end()
            except DefinitionError as exUntyped:
                if outer == 'type':
                    desc = "If just a name"
                elif outer == 'function':
                    desc = "If the function has no return type"
                else:
                    assert False
                prevErrors.append((exUntyped, desc))
                self.pos = startPos
                try:
                    declSpecs = self._parse_decl_specs(outer=outer)
                    decl = self._parse_declarator(named=True, paramMode=outer)
                except DefinitionError as exTyped:
                    self.pos = startPos
                    if outer == 'type':
                        desc = "If typedef-like declaration"
                    elif outer == 'function':
                        desc = "If the function has a return type"
                    else:
                        assert False
                    prevErrors.append((exTyped, desc))
                    # Retain the else branch for easier debugging.
                    # TODO: it would be nice to save the previous stacktrace
                    #       and output it here.
                    if True:
                        if outer == 'type':
                            header = "Type must be either just a name or a "
                            header += "typedef-like declaration."
                        elif outer == 'function':
                            header = "Error when parsing function declaration."
                        else:
                            assert False
                        raise self._make_multi_error(prevErrors, header)
                    else:
                        # For testing purposes.
                        # do it again to get the proper traceback (how do you
                        # relieable save a traceback when an exception is
                        # constructed?)
                        pass
                        self.pos = startPos
                        typed = True
                        declSpecs = self._parse_decl_specs(outer=outer, typed=typed)
                        decl = self._parse_declarator(named=True, paramMode=outer,
                                                      typed=typed)
        else:
            paramMode = 'type'
            if outer == 'member':  # i.e., member
                named = True
            elif outer == 'operatorCast':
                paramMode = 'operatorCast'
                outer = None
            elif outer == 'templateParam':
                named = 'single'
            declSpecs = self._parse_decl_specs(outer=outer)
            decl = self._parse_declarator(named=named, paramMode=paramMode)
        return ASTType(declSpecs, decl)

    def _parse_type_with_init(self, named, outer):
        # type: (Union[bool, unicode], unicode) -> ASTTypeWithInit
        if outer:
            assert outer in ('type', 'member', 'function', 'templateParam')
        type = self._parse_type(outer=outer, named=named)
        init = self._parse_initializer(outer=outer)
        return ASTTypeWithInit(type, init)

    def _parse_type_using(self):
        # type: () -> ASTTypeUsing
        name = self._parse_nested_name()
        self.skip_ws()
        if not self.skip_string('='):
            return ASTTypeUsing(name, None)
        type = self._parse_type(False, None)
        return ASTTypeUsing(name, type)

    def _parse_concept(self):
        # type: () -> ASTConcept
        nestedName = self._parse_nested_name()
        isFunction = False

        self.skip_ws()
        if self.skip_string('('):
            isFunction = True
            self.skip_ws()
            if not self.skip_string(')'):
                self.fail("Expected ')' in function concept declaration.")

        initializer = self._parse_initializer('member')
        if initializer and isFunction:
            self.fail("Function concept with initializer.")

        return ASTConcept(nestedName, isFunction, initializer)

    def _parse_class(self):
        # type: () -> ASTClass
        name = self._parse_nested_name()
        self.skip_ws()
        final = self.skip_word_and_ws('final')
        bases = []
        self.skip_ws()
        if self.skip_string(':'):
            while 1:
                self.skip_ws()
                visibility = 'private'  # type: unicode
                virtual = False
                pack = False
                if self.skip_word_and_ws('virtual'):
                    virtual = True
                if self.match(_visibility_re):
                    visibility = self.matched_text
                    self.skip_ws()
                if not virtual and self.skip_word_and_ws('virtual'):
                    virtual = True
                baseName = self._parse_nested_name()
                self.skip_ws()
                pack = self.skip_string('...')
                bases.append(ASTBaseClass(baseName, visibility, virtual, pack))
                self.skip_ws()
                if self.skip_string(','):
                    continue
                else:
                    break
        return ASTClass(name, final, bases)

    def _parse_enum(self):
        # type: () -> ASTEnum
        scoped = None  # type: unicode #  is set by CPPEnumObject
        self.skip_ws()
        name = self._parse_nested_name()
        self.skip_ws()
        underlyingType = None
        if self.skip_string(':'):
            underlyingType = self._parse_type(named=False)
        return ASTEnum(name, scoped, underlyingType)

    def _parse_enumerator(self):
        # type: () -> ASTEnumerator
        name = self._parse_nested_name()
        self.skip_ws()
        init = None
        if self.skip_string('='):
            self.skip_ws()
            init = ASTInitializer(self.read_rest())
        return ASTEnumerator(name, init)

    def _parse_template_parameter_list(self):
        # type: () -> ASTTemplateParams
        # only: '<' parameter-list '>'
        # we assume that 'template' has just been parsed
        templateParams = []  # type: List
        self.skip_ws()
        if not self.skip_string("<"):
            self.fail("Expected '<' after 'template'")
        while 1:
            prevErrors = []
            self.skip_ws()
            if self.skip_word('template'):
                # declare a tenplate template parameter
                nestedParams = self._parse_template_parameter_list()
                nestedParams.isNested = True
            else:
                nestedParams = None
            self.skip_ws()
            key = None
            if self.skip_word_and_ws('typename'):
                key = 'typename'
            elif self.skip_word_and_ws('class'):
                key = 'class'
            elif nestedParams:
                self.fail("Expected 'typename' or 'class' after "
                          "template template parameter list.")
            if key:
                # declare a type or template type parameter
                self.skip_ws()
                parameterPack = self.skip_string('...')
                self.skip_ws()
                if self.match(_identifier_re):
                    identifier = ASTIdentifier(self.matched_text)
                else:
                    identifier = None
                self.skip_ws()
                if not parameterPack and self.skip_string('='):
                    default = self._parse_type(named=False, outer=None)
                else:
                    default = None
                data = ASTTemplateKeyParamPackIdDefault(key, identifier,
                                                        parameterPack, default)
                if nestedParams:
                    # template type
                    param = ASTTemplateParamTemplateType(nestedParams, data)  # type: Any
                else:
                    # type
                    param = ASTTemplateParamType(data)
                templateParams.append(param)
            else:
                # declare a non-type parameter
                pos = self.pos
                try:
                    param = self._parse_type_with_init('maybe', 'templateParam')
                    templateParams.append(ASTTemplateParamNonType(param))
                except DefinitionError as e:
                    prevErrors.append((e, "If non-type template parameter"))
                    self.pos = pos
            self.skip_ws()
            if self.skip_string('>'):
                return ASTTemplateParams(templateParams)
            elif self.skip_string(','):
                continue
            else:
                header = "Error in template parameter list."
                try:
                    self.fail('Expected "=", ",", or ">".')
                except DefinitionError as e:
                    prevErrors.append((e, ""))
                raise self._make_multi_error(prevErrors, header)

    def _parse_template_introduction(self):
        # type: () -> ASTTemplateIntroduction
        pos = self.pos
        try:
            concept = self._parse_nested_name()
        except:
            self.pos = pos
            return None
        self.skip_ws()
        if not self.skip_string('{'):
            self.pos = pos
            return None

        # for sure it must be a template introduction now
        params = []
        while 1:
            self.skip_ws()
            parameterPack = self.skip_string('...')
            self.skip_ws()
            if not self.match(_identifier_re):
                self.fail("Expected identifier in template introduction list.")
            identifier = self.matched_text
            # make sure there isn't a keyword
            if identifier in _keywords:
                self.fail("Expected identifier in template introduction list, "
                          "got keyword: %s" % identifier)
            identifier = ASTIdentifier(identifier)  # type: ignore
            params.append(ASTTemplateIntroductionParameter(identifier, parameterPack))

            self.skip_ws()
            if self.skip_string('}'):
                break
            elif self.skip_string(','):
                continue
            else:
                self.fail("Error in template introduction list. "
                          'Expected ",", or "}".')
        return ASTTemplateIntroduction(concept, params)

    def _parse_template_declaration_prefix(self, objectType):
        # type: (unicode) -> ASTTemplateDeclarationPrefix
        templates = []  # type: List
        while 1:
            self.skip_ws()
            # the saved position is only used to provide a better error message
            pos = self.pos
            if self.skip_word("template"):
                params = self._parse_template_parameter_list()  # type: Any
            else:
                params = self._parse_template_introduction()
                if not params:
                    break
            if objectType == 'concept' and len(templates) > 0:
                self.pos = pos
                self.fail("More than 1 template parameter list for concept.")
            templates.append(params)
        if len(templates) == 0 and objectType == 'concept':
            self.fail('Missing template parameter list for concept.')
        if len(templates) == 0:
            return None
        else:
            return ASTTemplateDeclarationPrefix(templates)

    def _check_template_consistency(self, nestedName, templatePrefix,
                                    fullSpecShorthand):
        # type: (Any, Any, bool) -> ASTTemplateDeclarationPrefix
        numArgs = nestedName.num_templates()
        if not templatePrefix:
            numParams = 0
        else:
            numParams = len(templatePrefix.templates)
        if numArgs + 1 < numParams:
            self.fail("Too few template argument lists comapred to parameter"
                      " lists. Argument lists: %d, Parameter lists: %d."
                      % (numArgs, numParams))
        if numArgs > numParams:
            numExtra = numArgs - numParams
            if not fullSpecShorthand:
                msg = "Too many template argument lists compared to parameter" \
                    " lists. Argument lists: %d, Parameter lists: %d," \
                    " Extra empty parameters lists prepended: %d." \
                    % (numArgs, numParams, numExtra)  # type: unicode
                msg += " Declaration:\n\t"
                if templatePrefix:
                    msg += "%s\n\t" % text_type(templatePrefix)
                msg += text_type(nestedName)
                self.warn(msg)

            newTemplates = []
            for i in range(numExtra):
                newTemplates.append(ASTTemplateParams([]))
            if templatePrefix:
                newTemplates.extend(templatePrefix.templates)
            templatePrefix = ASTTemplateDeclarationPrefix(newTemplates)
        return templatePrefix

    def parse_declaration(self, objectType):
        # type: (unicode) -> ASTDeclaration
        if objectType not in ('type', 'concept', 'member',
                              'function', 'class', 'enum', 'enumerator'):
            raise Exception('Internal error, unknown objectType "%s".' % objectType)
        visibility = None
        templatePrefix = None
        declaration = None  # type: Any

        self.skip_ws()
        if self.match(_visibility_re):
            visibility = self.matched_text

        if objectType in ('type', 'concept', 'member', 'function', 'class'):
            templatePrefix = self._parse_template_declaration_prefix(objectType)

        if objectType == 'type':
            prevErrors = []
            pos = self.pos
            try:
                if not templatePrefix:
                    declaration = self._parse_type(named=True, outer='type')
            except DefinitionError as e:
                prevErrors.append((e, "If typedef-like declaration"))
                self.pos = pos
            pos = self.pos
            try:
                if not declaration:
                    declaration = self._parse_type_using()
            except DefinitionError as e:
                self.pos = pos
                prevErrors.append((e, "If type alias or template alias"))
                header = "Error in type declaration."
                raise self._make_multi_error(prevErrors, header)
        elif objectType == 'concept':
            declaration = self._parse_concept()
        elif objectType == 'member':
            declaration = self._parse_type_with_init(named=True, outer='member')
        elif objectType == 'function':
            declaration = self._parse_type(named=True, outer='function')
        elif objectType == 'class':
            declaration = self._parse_class()
        elif objectType == 'enum':
            declaration = self._parse_enum()
        elif objectType == 'enumerator':
            declaration = self._parse_enumerator()
        else:
            assert False
        templatePrefix = self._check_template_consistency(declaration.name,
                                                          templatePrefix,
                                                          fullSpecShorthand=False)
        return ASTDeclaration(objectType, visibility,
                              templatePrefix, declaration)

    def parse_namespace_object(self):
        # type: () -> ASTNamespace
        templatePrefix = self._parse_template_declaration_prefix(objectType="namespace")
        name = self._parse_nested_name()
        templatePrefix = self._check_template_consistency(name, templatePrefix,
                                                          fullSpecShorthand=False)
        res = ASTNamespace(name, templatePrefix)
        res.objectType = 'namespace'  # type: ignore
        return res

    def parse_xref_object(self):
        # type: () -> ASTNamespace
        templatePrefix = self._parse_template_declaration_prefix(objectType="xref")
        name = self._parse_nested_name()
        # if there are '()' left, just skip them
        self.skip_ws()
        self.skip_string('()')
        templatePrefix = self._check_template_consistency(name, templatePrefix,
                                                          fullSpecShorthand=True)
        res = ASTNamespace(name, templatePrefix)
        res.objectType = 'xref'  # type: ignore
        return res


def _make_phony_error_name():
    # type: () -> ASTNestedName
    nne = ASTNestedNameElement(ASTIdentifier("PhonyNameDueToError"), None)
    return ASTNestedName([nne], rooted=False)


class CPPObject(ObjectDescription):
    """Description of a C++ language object."""

    doc_field_types = [
        GroupedField('parameter', label=l_('Parameters'),
                     names=('param', 'parameter', 'arg', 'argument'),
                     can_collapse=True),
        GroupedField('template parameter', label=l_('Template Parameters'),
                     names=('tparam', 'template parameter'),
                     can_collapse=True),
        GroupedField('exceptions', label=l_('Throws'), rolename='cpp:class',
                     names=('throws', 'throw', 'exception'),
                     can_collapse=True),
        Field('returnvalue', label=l_('Returns'), has_arg=False,
              names=('returns', 'return')),
    ]

    option_spec = dict(ObjectDescription.option_spec)
    option_spec['tparam-line-spec'] = directives.flag

    def warn(self, msg):
        # type: (unicode) -> None
        self.state_machine.reporter.warning(msg, line=self.lineno)

    def _add_enumerator_to_parent(self, ast):
        # type: (Any) -> None
        assert ast.objectType == 'enumerator'
        # find the parent, if it exists && is an enum
        #                     && it's unscoped,
        #                  then add the name to the parent scope
        symbol = ast.symbol
        assert symbol
        assert symbol.identifier is not None
        assert symbol.templateParams is None
        assert symbol.templateArgs is None
        parentSymbol = symbol.parent
        assert parentSymbol
        if parentSymbol.parent is None:
            # TODO: we could warn, but it is somewhat equivalent to unscoped
            # enums, without the enum
            return  # no parent
        parentDecl = parentSymbol.declaration
        if parentDecl is None:
            # the parent is not explicitly declared
            # TODO: we could warn, but it could be a style to just assume
            # enumerator parnets to be scoped
            return
        if parentDecl.objectType != 'enum':
            # TODO: maybe issue a warning, enumerators in non-enums is weird,
            # but it is somewhat equivalent to unscoped enums, without the enum
            return
        if parentDecl.scoped:
            return

        targetSymbol = parentSymbol.parent
        s = targetSymbol.find_identifier(symbol.identifier, matchSelf=False)
        if s is not None:
            # something is already declared with that name
            return
        declClone = symbol.declaration.clone()
        declClone.enumeratorScopedSymbol = symbol
        Symbol(parent=targetSymbol, identifier=symbol.identifier,
               templateParams=None, templateArgs=None,
               declaration=declClone,
               docname=self.env.docname)

    def add_target_and_index(self, ast, sig, signode):
        # type: (Any, unicode, addnodes.desc_signature) -> None
        # general note: name must be lstrip(':')'ed, to remove "::"
        try:
            id_v1 = ast.get_id_v1()
        except NoOldIdError:
            id_v1 = None
        id_v2 = ast.get_id_v2()
        # store them in reverse order, so the newest is first
        ids = [id_v2, id_v1]

        newestId = ids[0]
        assert newestId  # shouldn't be None
        if not re.compile(r'^[a-zA-Z0-9_]*$').match(newestId):
            self.warn('Index id generation for C++ object "%s" failed, please '
                      'report as bug (id=%s).' % (text_type(ast), newestId))

        name = text_type(ast.symbol.get_full_nested_name()).lstrip(':')
        strippedName = name
        for prefix in self.env.config.cpp_index_common_prefix:
            if name.startswith(prefix):
                strippedName = strippedName[len(prefix):]
                break
        indexText = self.get_index_text(strippedName)
        self.indexnode['entries'].append(('single', indexText, newestId, '', None))

        if newestId not in self.state.document.ids:
            # if the name is not unique, the first one will win
            names = self.env.domaindata['cpp']['names']
            if name not in names:
                names[name] = ast.symbol.docname
                signode['names'].append(name)
            else:
                # print("[CPP] non-unique name:", name)
                pass
            # always add the newest id
            assert newestId
            signode['ids'].append(newestId)
            # only add compatibility ids when there are no conflicts
            for id in ids[1:]:
                if not id:  # is None when the element didn't exist in that version
                    continue
                if id not in self.state.document.ids:
                    signode['ids'].append(id)
            signode['first'] = (not self.names)  # hmm, what is this about?
            self.state.document.note_explicit_target(signode)

    def parse_definition(self, parser):
        # type: (Any) -> Any
        raise NotImplementedError()

    def describe_signature(self, signode, ast, options):
        # type: (addnodes.desc_signature, Any, Dict) -> None
        ast.describe_signature(signode, 'lastIsName', self.env, options)

    def handle_signature(self, sig, signode):
        # type: (unicode, addnodes.desc_signature) -> Any
        if 'cpp:parent_symbol' not in self.env.temp_data:
            root = self.env.domaindata['cpp']['root_symbol']
            self.env.temp_data['cpp:parent_symbol'] = root
            self.env.ref_context['cpp:parent_key'] = root.get_lookup_key()
        parentSymbol = self.env.temp_data['cpp:parent_symbol']

        parser = DefinitionParser(sig, self, self.env.config)
        try:
            ast = self.parse_definition(parser)
            parser.assert_end()
        except DefinitionError as e:
            self.warn(e.description)
            # It is easier to assume some phony name than handling the error in
            # the possibly inner declarations.
            name = _make_phony_error_name()
            symbol = parentSymbol.add_name(name)
            self.env.temp_data['cpp:last_symbol'] = symbol
            raise ValueError

        try:
            symbol = parentSymbol.add_declaration(ast, docname=self.env.docname)
            self.env.temp_data['cpp:last_symbol'] = symbol
        except _DuplicateSymbolError as e:
            # Assume we are actually in the old symbol,
            # instead of the newly created duplicate.
            self.env.temp_data['cpp:last_symbol'] = e.symbol

        if ast.objectType == 'enumerator':
            self._add_enumerator_to_parent(ast)

        self.options['tparam-line-spec'] = 'tparam-line-spec' in self.options
        self.describe_signature(signode, ast, self.options)
        return ast

    def before_content(self):
        # type: () -> None
        lastSymbol = self.env.temp_data['cpp:last_symbol']
        assert lastSymbol
        self.oldParentSymbol = self.env.temp_data['cpp:parent_symbol']
        self.oldParentKey = self.env.ref_context['cpp:parent_key']
        self.env.temp_data['cpp:parent_symbol'] = lastSymbol
        self.env.ref_context['cpp:parent_key'] = lastSymbol.get_lookup_key()

    def after_content(self):
        # type: () -> None
        self.env.temp_data['cpp:parent_symbol'] = self.oldParentSymbol
        self.env.ref_context['cpp:parent_key'] = self.oldParentKey


class CPPTypeObject(CPPObject):
    def get_index_text(self, name):
        # type: (unicode) -> unicode
        return _('%s (C++ type)') % name

    def parse_definition(self, parser):
        # type: (Any) -> Any
        return parser.parse_declaration("type")


class CPPConceptObject(CPPObject):
    def get_index_text(self, name):
        # type: (unicode) -> unicode
        return _('%s (C++ concept)') % name

    def parse_definition(self, parser):
        # type: (Any) -> Any
        return parser.parse_declaration("concept")


class CPPMemberObject(CPPObject):
    def get_index_text(self, name):
        # type: (unicode) -> unicode
        return _('%s (C++ member)') % name

    def parse_definition(self, parser):
        # type: (Any) -> Any
        return parser.parse_declaration("member")


class CPPFunctionObject(CPPObject):
    def get_index_text(self, name):
        # type: (unicode) -> unicode
        return _('%s (C++ function)') % name

    def parse_definition(self, parser):
        # type: (Any) -> Any
        return parser.parse_declaration("function")


class CPPClassObject(CPPObject):
    def get_index_text(self, name):
        # type: (unicode) -> unicode
        return _('%s (C++ class)') % name

    def parse_definition(self, parser):
        # type: (Any) -> Any
        return parser.parse_declaration("class")


class CPPEnumObject(CPPObject):
    def get_index_text(self, name):
        # type: (unicode) -> unicode
        return _('%s (C++ enum)') % name

    def parse_definition(self, parser):
        # type: (Any) -> Any
        ast = parser.parse_declaration("enum")
        # self.objtype is set by ObjectDescription in run()
        if self.objtype == "enum":
            ast.scoped = None
        elif self.objtype == "enum-struct":
            ast.scoped = "struct"
        elif self.objtype == "enum-class":
            ast.scoped = "class"
        else:
            assert False
        return ast


class CPPEnumeratorObject(CPPObject):
    def get_index_text(self, name):
        # type: (unicode) -> unicode
        return _('%s (C++ enumerator)') % name

    def parse_definition(self, parser):
        # type: (Any) -> Any
        return parser.parse_declaration("enumerator")


class CPPNamespaceObject(Directive):
    """
    This directive is just to tell Sphinx that we're documenting stuff in
    namespace foo.
    """

    has_content = False
    required_arguments = 1
    optional_arguments = 0
    final_argument_whitespace = True
    option_spec = {}  # type: Dict

    def warn(self, msg):
        # type: (unicode) -> None
        self.state_machine.reporter.warning(msg, line=self.lineno)

    def run(self):
        # type: () -> List[nodes.Node]
        env = self.state.document.settings.env
        rootSymbol = env.domaindata['cpp']['root_symbol']
        if self.arguments[0].strip() in ('NULL', '0', 'nullptr'):
            symbol = rootSymbol
            stack = []  # type: List[Symbol]
        else:
            parser = DefinitionParser(self.arguments[0], self, env.config)
            try:
                ast = parser.parse_namespace_object()
                parser.assert_end()
            except DefinitionError as e:
                self.warn(e.description)
                name = _make_phony_error_name()
                ast = ASTNamespace(name, None)
            symbol = rootSymbol.add_name(ast.nestedName, ast.templatePrefix)
            stack = [symbol]
        env.temp_data['cpp:parent_symbol'] = symbol
        env.temp_data['cpp:namespace_stack'] = stack
        env.ref_context['cpp:parent_key'] = symbol.get_lookup_key()
        return []


class CPPNamespacePushObject(Directive):
    has_content = False
    required_arguments = 1
    optional_arguments = 0
    final_argument_whitespace = True
    option_spec = {}  # type: Dict

    def warn(self, msg):
        # type: (unicode) -> None
        self.state_machine.reporter.warning(msg, line=self.lineno)

    def run(self):
        # type: () -> List[nodes.Node]
        env = self.state.document.settings.env
        if self.arguments[0].strip() in ('NULL', '0', 'nullptr'):
            return []
        parser = DefinitionParser(self.arguments[0], self, env.config)
        try:
            ast = parser.parse_namespace_object()
            parser.assert_end()
        except DefinitionError as e:
            self.warn(e.description)
            name = _make_phony_error_name()
            ast = ASTNamespace(name, None)
        oldParent = env.temp_data.get('cpp:parent_symbol', None)
        if not oldParent:
            oldParent = env.domaindata['cpp']['root_symbol']
        symbol = oldParent.add_name(ast.nestedName, ast.templatePrefix)
        stack = env.temp_data.get('cpp:namespace_stack', [])
        stack.append(symbol)
        env.temp_data['cpp:parent_symbol'] = symbol
        env.temp_data['cpp:namespace_stack'] = stack
        env.ref_context['cpp:parent_key'] = symbol.get_lookup_key()
        return []


class CPPNamespacePopObject(Directive):
    has_content = False
    required_arguments = 0
    optional_arguments = 0
    final_argument_whitespace = True
    option_spec = {}  # type: Dict

    def warn(self, msg):
        # type: (unicode) -> None
        self.state_machine.reporter.warning(msg, line=self.lineno)

    def run(self):
        # type: () -> List[nodes.Node]
        env = self.state.document.settings.env
        stack = env.temp_data.get('cpp:namespace_stack', None)
        if not stack or len(stack) == 0:
            self.warn("C++ namespace pop on empty stack. Defaulting to gobal scope.")
            stack = []
        else:
            stack.pop()
        if len(stack) > 0:
            symbol = stack[-1]
        else:
            symbol = env.domaindata['cpp']['root_symbol']
        env.temp_data['cpp:parent_symbol'] = symbol
        env.temp_data['cpp:namespace_stack'] = stack
        env.ref_context['cpp:parent_key'] = symbol.get_lookup_key()
        return []


class CPPXRefRole(XRefRole):
    def process_link(self, env, refnode, has_explicit_title, title, target):
        # type: (BuildEnvironment, nodes.Node, bool, unicode, unicode) -> Tuple[unicode, unicode]  # NOQA
        refnode.attributes.update(env.ref_context)
        if refnode['reftype'] == 'any':
            # Assume the removal part of fix_parens for :any: refs.
            # The addition part is done with the reference is resolved.
            if not has_explicit_title and title.endswith('()'):
                title = title[:-2]
            if target.endswith('()'):
                target = target[:-2]
        # TODO: should this really be here?
        if not has_explicit_title:
            target = target.lstrip('~')  # only has a meaning for the title
            # if the first character is a tilde, don't display the module/class
            # parts of the contents
            if title[:1] == '~':
                title = title[1:]
                dcolon = title.rfind('::')
                if dcolon != -1:
                    title = title[dcolon + 2:]
        return title, target


class CPPDomain(Domain):
    """C++ language domain."""
    name = 'cpp'
    label = 'C++'
    object_types = {
        'class': ObjType(l_('class'), 'class'),
        'function': ObjType(l_('function'), 'func'),
        'member': ObjType(l_('member'), 'member'),
        'type': ObjType(l_('type'), 'type'),
        'concept': ObjType(l_('concept'), 'concept'),
        'enum': ObjType(l_('enum'), 'enum'),
        'enumerator': ObjType(l_('enumerator'), 'enumerator')
    }

    directives = {
        'class': CPPClassObject,
        'function': CPPFunctionObject,
        'member': CPPMemberObject,
        'var': CPPMemberObject,
        'type': CPPTypeObject,
        'concept': CPPConceptObject,
        'enum': CPPEnumObject,
        'enum-struct': CPPEnumObject,
        'enum-class': CPPEnumObject,
        'enumerator': CPPEnumeratorObject,
        'namespace': CPPNamespaceObject,
        'namespace-push': CPPNamespacePushObject,
        'namespace-pop': CPPNamespacePopObject
    }
    roles = {
        'any': CPPXRefRole(),
        'class': CPPXRefRole(),
        'func': CPPXRefRole(fix_parens=True),
        'member': CPPXRefRole(),
        'var': CPPXRefRole(),
        'type': CPPXRefRole(),
        'concept': CPPXRefRole(),
        'enum': CPPXRefRole(),
        'enumerator': CPPXRefRole()
    }
    initial_data = {
        'root_symbol': Symbol(None, None, None, None, None, None),
        'names': {}  # full name for indexing -> docname
    }

    def clear_doc(self, docname):
        # type: (unicode) -> None
        rootSymbol = self.data['root_symbol']
        rootSymbol.clear_doc(docname)
        for name, nDocname in list(self.data['names'].items()):
            if nDocname == docname:
                del self.data['names'][name]

    def process_doc(self, env, docname, document):
        # type: (BuildEnvironment, unicode, nodes.Node) -> None
        # just for debugging
        # print(docname)
        # print(self.data['root_symbol'].dump(0))
        pass

    def process_field_xref(self, pnode):
        # type: (nodes.Node) -> None
        pnode.attributes.update(self.env.ref_context)

    def merge_domaindata(self, docnames, otherdata):
        # type: (List[unicode], Dict) -> None
        self.data['root_symbol'].merge_with(otherdata['root_symbol'],
                                            docnames, self.env)
        ourNames = self.data['names']
        for name, docname in otherdata['names'].items():
            if docname in docnames:
                if name in ourNames:
                    msg = "Duplicate declaration, also defined in '%s'.\n"
                    msg += "Name of declaration is '%s'."
                    msg = msg % (ourNames[name], name)
                    logger.warning(msg, docname)
                else:
                    ourNames[name] = docname

    def _resolve_xref_inner(self, env, fromdocname, builder, typ,
                            target, node, contnode, emitWarnings=True):
        # type: (BuildEnvironment, unicode, Builder, unicode, unicode, nodes.Node, nodes.Node, bool) -> nodes.Node  # NOQA
        class Warner(object):
            def warn(self, msg):
                if emitWarnings:
                    logger.warning(msg, location=node)
        warner = Warner()
        # add parens again for those that could be functions
        if typ == 'any' or typ == 'func':
            target += '()'
        parser = DefinitionParser(target, warner, env.config)
        try:
            ast = parser.parse_xref_object()
            parser.assert_end()
        except DefinitionError as e:
            def findWarning(e):  # as arg to stop flake8 from complaining
                if typ != 'any' and typ != 'func':
                    return target, e
                # hax on top of the paren hax to try to get correct errors
                parser2 = DefinitionParser(target[:-2], warner, env.config)
                try:
                    parser2.parse_xref_object()
                    parser2.assert_end()
                except DefinitionError as e2:
                    return target[:-2], e2
                # strange, that we don't get the error now, use the original
                return target, e
            t, ex = findWarning(e)
            warner.warn('Unparseable C++ cross-reference: %r\n%s'
                        % (t, text_type(ex.description)))
            return None, None
        parentKey = node.get("cpp:parent_key", None)
        rootSymbol = self.data['root_symbol']
        if parentKey:
            parentSymbol = rootSymbol.direct_lookup(parentKey)
            if not parentSymbol:
                print("Target: ", target)
                print("ParentKey: ", parentKey)
            assert parentSymbol  # should be there
        else:
            parentSymbol = rootSymbol

        name = ast.nestedName
        if ast.templatePrefix:
            templateDecls = ast.templatePrefix.templates
        else:
            templateDecls = []
        s = parentSymbol.find_name(name, templateDecls,
                                   templateShorthand=True,
                                   matchSelf=True)
        if s is None or s.declaration is None:
            return None, None

        if typ.startswith('cpp:'):
            typ = typ[4:]
        if typ == 'func':
            typ = 'function'
        declTyp = s.declaration.objectType

        def checkType():
            if typ == 'any':
                return True
            if declTyp == 'templateParam':
                return True
            if typ == 'var' or typ == 'member':
                return declTyp in ['var', 'member']
            if typ in ['enum', 'enumerator', 'function', 'class', 'concept']:
                return declTyp == typ
            validForType = ['enum', 'class', 'function', 'type']
            if typ == 'typeOrConcept':
                return declTyp == 'concept' or declTyp in validForType
            if typ == 'type':
                return declTyp in validForType
            print("Type is %s" % typ)
            assert False
        if not checkType():
            warner.warn("cpp:%s targets a %s (%s)."
                        % (typ, s.declaration.objectType,
                           s.get_full_nested_name()))

        declaration = s.declaration
        fullNestedName = s.get_full_nested_name()
        name = text_type(fullNestedName).lstrip(':')
        docname = s.docname
        assert docname
        # If it's operator(), we need to add '()' if explicit function parens
        # are requested. Then the Sphinx machinery will add another pair.
        # Also, if it's an 'any' ref that resolves to a function, we need to add
        # parens as well.
        addParen = 0
        if not node.get('refexplicit', False) and declaration.objectType == 'function':
            # this is just the normal haxing for 'any' roles
            if env.config.add_function_parentheses and typ == 'any':
                addParen += 1
            # and now this stuff for operator()
            if (env.config.add_function_parentheses and typ == 'function' and
                    contnode[-1].astext().endswith('operator()')):
                addParen += 1
            if ((typ == 'any' or typ == 'function') and
                    contnode[-1].astext().endswith('operator') and
                    name.endswith('operator()')):
                addParen += 1
        if addParen > 0:
            title = contnode.pop(0).astext()
            contnode += nodes.Text(title + '()' * addParen)
        return make_refnode(builder, fromdocname, docname,
                            declaration.get_newest_id(), contnode, name
                            ), declaration.objectType

    def resolve_xref(self, env, fromdocname, builder,
                     typ, target, node, contnode):
        # type: (BuildEnvironment, unicode, Builder, unicode, unicode, nodes.Node, nodes.Node) -> nodes.Node  # NOQA
        return self._resolve_xref_inner(env, fromdocname, builder, typ,
                                        target, node, contnode)[0]

    def resolve_any_xref(self, env, fromdocname, builder, target,
                         node, contnode):
        # type: (BuildEnvironment, unicode, Builder, unicode, nodes.Node, nodes.Node) -> List[Tuple[unicode, nodes.Node]]  # NOQA
        node, objtype = self._resolve_xref_inner(env, fromdocname, builder,
                                                 'any', target, node, contnode,
                                                 emitWarnings=False)
        if node:
            if objtype == 'templateParam':
                return [('cpp:templateParam', node)]
            else:
                return [('cpp:' + self.role_for_objtype(objtype), node)]
        return []

    def get_objects(self):
        # type: () -> Iterator[Tuple[unicode, unicode, unicode, unicode, unicode, int]]
        rootSymbol = self.data['root_symbol']
        for symbol in rootSymbol.get_all_symbols():
            if symbol.declaration is None:
                continue
            assert symbol.docname
            name = text_type(symbol.get_full_nested_name()).lstrip(':')
            objectType = symbol.declaration.objectType
            docname = symbol.docname
            newestId = symbol.declaration.get_newest_id()
            yield (name, name, objectType, docname, newestId, 1)

    def get_full_qualified_name(self, node):
        # type: (nodes.Node) -> unicode
        target = node.get('reftarget', None)
        if target is None:
            return None
        parentKey = node.get("cpp:parent_key", None)
        if parentKey is None:
            return None

        rootSymbol = self.data['root_symbol']
        parentSymbol = rootSymbol.direct_lookup(parentKey)
        parentName = parentSymbol.get_full_nested_name()
        return '::'.join([text_type(parentName), target])


def setup(app):
    # type: (Sphinx) -> Dict[unicode, Any]
    app.add_domain(CPPDomain)
    app.add_config_value("cpp_index_common_prefix", [], 'env')
    app.add_config_value("cpp_id_attributes", [], 'env')
    app.add_config_value("cpp_paren_attributes", [], 'env')

    return {
        'version': 'builtin',
        'parallel_read_safe': True,
        'parallel_write_safe': True,
    }
