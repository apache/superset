# -*- coding: utf-8 -*-
"""
    pygments.lexers.clean
    ~~~~~~~~~~~~~~~~~~~~~

    Lexer for the Clean language.

    :copyright: Copyright 2006-2017 by the Pygments team, see AUTHORS.
    :license: BSD, see LICENSE for details.
"""

from pygments.lexer import ExtendedRegexLexer, LexerContext, \
    bygroups, words, include, default
from pygments.token import Comment, Keyword, Literal, Name, Number, Operator, \
    Punctuation, String, Text, Whitespace

__all__ = ['CleanLexer']


class CleanLexer(ExtendedRegexLexer):
    """
    Lexer for the general purpose, state-of-the-art, pure and lazy functional
    programming language Clean (http://clean.cs.ru.nl/Clean).

    .. versionadded: 2.2
    """
    name = 'Clean'
    aliases = ['clean']
    filenames = ['*.icl', '*.dcl']

    def get_tokens_unprocessed(self, text=None, context=None):
        ctx = LexerContext(text, 0)
        ctx.indent = 0
        return ExtendedRegexLexer.get_tokens_unprocessed(self, text, context=ctx)

    def check_class_not_import(lexer, match, ctx):
        if match.group(0) == 'import':
            yield match.start(), Keyword.Namespace, match.group(0)
            ctx.stack = ctx.stack[:-1] + ['fromimportfunc']
        else:
            yield match.start(), Name.Class, match.group(0)
        ctx.pos = match.end()

    def check_instance_class(lexer, match, ctx):
        if match.group(0) == 'instance' or match.group(0) == 'class':
            yield match.start(), Keyword, match.group(0)
        else:
            yield match.start(), Name.Function, match.group(0)
            ctx.stack = ctx.stack + ['fromimportfunctype']
        ctx.pos = match.end()

    @staticmethod
    def indent_len(text):
        # Tabs are four spaces:
        # https://svn.cs.ru.nl/repos/clean-platform/trunk/doc/STANDARDS.txt
        text = text.replace('\n', '')
        return len(text.replace('\t', '    ')), len(text)

    def store_indent(lexer, match, ctx):
        ctx.indent, _ = CleanLexer.indent_len(match.group(0))
        ctx.pos = match.end()
        yield match.start(), Text, match.group(0)

    def check_indent1(lexer, match, ctx):
        indent, reallen = CleanLexer.indent_len(match.group(0))
        if indent > ctx.indent:
            yield match.start(), Whitespace, match.group(0)
            ctx.pos = match.start() + reallen + 1
        else:
            ctx.indent = 0
            ctx.pos = match.start()
            ctx.stack = ctx.stack[:-1]
            yield match.start(), Whitespace, match.group(0)[1:]

    def check_indent2(lexer, match, ctx):
        indent, reallen = CleanLexer.indent_len(match.group(0))
        if indent > ctx.indent:
            yield match.start(), Whitespace, match.group(0)
            ctx.pos = match.start() + reallen + 1
        else:
            ctx.indent = 0
            ctx.pos = match.start()
            ctx.stack = ctx.stack[:-2]

    def check_indent3(lexer, match, ctx):
        indent, reallen = CleanLexer.indent_len(match.group(0))
        if indent > ctx.indent:
            yield match.start(), Whitespace, match.group(0)
            ctx.pos = match.start() + reallen + 1
        else:
            ctx.indent = 0
            ctx.pos = match.start()
            ctx.stack = ctx.stack[:-3]
            yield match.start(), Whitespace, match.group(0)[1:]
            if match.group(0) == '\n\n':
                ctx.pos = ctx.pos + 1

    def skip(lexer, match, ctx):
        ctx.stack = ctx.stack[:-1]
        ctx.pos = match.end()
        yield match.start(), Comment, match.group(0)

    keywords = ('class', 'instance', 'where', 'with', 'let', 'let!',
                'in', 'case', 'of', 'infix', 'infixr', 'infixl', 'generic',
                'derive', 'otherwise', 'code', 'inline')

    tokens = {
        'common': [
            (r';', Punctuation, '#pop'),
            (r'//', Comment, 'singlecomment'),
        ],
        'root': [
            # Comments
            (r'//.*\n', Comment.Single),
            (r'(?s)/\*\*.*?\*/', Comment.Special),
            (r'(?s)/\*.*?\*/', Comment.Multi),

            # Modules, imports, etc.
            (r'\b((?:implementation|definition|system)\s+)?(module)(\s+)([\w`.]+)',
                bygroups(Keyword.Namespace, Keyword.Namespace, Text, Name.Class)),
            (r'(?<=\n)import(?=\s)', Keyword.Namespace, 'import'),
            (r'(?<=\n)from(?=\s)', Keyword.Namespace, 'fromimport'),

            # Keywords
            # We cannot use (?s)^|(?<=\s) as prefix, so need to repeat this
            (words(keywords, prefix=r'(?<=\s)', suffix=r'(?=\s)'), Keyword),
            (words(keywords, prefix=r'^', suffix=r'(?=\s)'), Keyword),

            # Function definitions
            (r'(?=\{\|)', Whitespace, 'genericfunction'),
            (r'(?<=\n)([ \t]*)([\w`$()=\-<>~*\^|+&%]+)((?:\s+\w)*)(\s*)(::)',
             bygroups(store_indent, Name.Function, Keyword.Type, Whitespace,
                      Punctuation),
             'functiondefargs'),

            # Type definitions
            (r'(?<=\n)([ \t]*)(::)', bygroups(store_indent, Punctuation), 'typedef'),
            (r'^([ \t]*)(::)', bygroups(store_indent, Punctuation), 'typedef'),

            # Literals
            (r'\'\\?.(?<!\\)\'', String.Char),
            (r'\'\\\d+\'', String.Char),
            (r'\'\\\\\'', String.Char),  # (special case for '\\')
            (r'[+\-~]?\s*\d+\.\d+(E[+\-~]?\d+)?\b', Number.Float),
            (r'[+\-~]?\s*0[0-7]\b', Number.Oct),
            (r'[+\-~]?\s*0x[0-9a-fA-F]\b', Number.Hex),
            (r'[+\-~]?\s*\d+\b', Number.Integer),
            (r'"', String.Double, 'doubleqstring'),
            (words(('True', 'False'), prefix=r'(?<=\s)', suffix=r'(?=\s)'),
             Literal),

            # Qualified names
            (r'(\')([\w.]+)(\'\.)',
                bygroups(Punctuation, Name.Namespace, Punctuation)),

            # Everything else is some name
            (r'([\w`$%/?@]+\.?)*[\w`$%/?@]+', Name),

            # Punctuation
            (r'[{}()\[\],:;.#]', Punctuation),
            (r'[+\-=!<>|&~*\^/]', Operator),
            (r'\\\\', Operator),

            # Lambda expressions
            (r'\\.*?(->|\.|=)', Name.Function),

            # Whitespace
            (r'\s', Whitespace),

            include('common'),
        ],
        'fromimport': [
            include('common'),
            (r'([\w`.]+)', check_class_not_import),
            (r'\n', Whitespace, '#pop'),
            (r'\s', Whitespace),
        ],
        'fromimportfunc': [
            include('common'),
            (r'(::)(\s+)([^,\s]+)', bygroups(Punctuation, Text, Keyword.Type)),
            (r'([\w`$()=\-<>~*\^|+&%/]+)', check_instance_class),
            (r',', Punctuation),
            (r'\n', Whitespace, '#pop'),
            (r'\s', Whitespace),
        ],
        'fromimportfunctype': [
            include('common'),
            (r'[{(\[]', Punctuation, 'combtype'),
            (r',', Punctuation, '#pop'),
            (r'[:;.#]', Punctuation),
            (r'\n', Whitespace, '#pop:2'),
            (r'[^\S\n]+', Whitespace),
            (r'\S+', Keyword.Type),
        ],
        'combtype': [
            include('common'),
            (r'[})\]]', Punctuation, '#pop'),
            (r'[{(\[]', Punctuation, '#pop'),
            (r'[,:;.#]', Punctuation),
            (r'\s+', Whitespace),
            (r'\S+', Keyword.Type),
        ],
        'import': [
            include('common'),
            (words(('from', 'import', 'as', 'qualified'),
                   prefix='(?<=\s)', suffix='(?=\s)'), Keyword.Namespace),
            (r'[\w`.]+', Name.Class),
            (r'\n', Whitespace, '#pop'),
            (r',', Punctuation),
            (r'[^\S\n]+', Whitespace),
        ],
        'singlecomment': [
            (r'(.)(?=\n)', skip),
            (r'.+(?!\n)', Comment),
        ],
        'doubleqstring': [
            (r'[^\\"]+', String.Double),
            (r'"', String.Double, '#pop'),
            (r'\\.', String.Double),
        ],
        'typedef': [
            include('common'),
            (r'[\w`]+', Keyword.Type),
            (r'[:=|(),\[\]{}!*]', Punctuation),
            (r'->', Punctuation),
            (r'\n(?=[^\s|])', Whitespace, '#pop'),
            (r'\s', Whitespace),
            (r'.', Keyword.Type),
        ],
        'genericfunction': [
            include('common'),
            (r'\{\|', Punctuation),
            (r'\|\}', Punctuation, '#pop'),
            (r',', Punctuation),
            (r'->', Punctuation),
            (r'(\s+of\s+)(\{)', bygroups(Keyword, Punctuation), 'genericftypes'),
            (r'\s', Whitespace),
            (r'[\w`\[\]{}!]+', Keyword.Type),
            (r'[*()]', Punctuation),
        ],
        'genericftypes': [
            include('common'),
            (r'[\w`]+', Keyword.Type),
            (r',', Punctuation),
            (r'\s', Whitespace),
            (r'\}', Punctuation, '#pop'),
        ],
        'functiondefargs': [
            include('common'),
            (r'\n(\s*)', check_indent1),
            (r'[!{}()\[\],:;.#]', Punctuation),
            (r'->', Punctuation, 'functiondefres'),
            (r'^(?=\S)', Whitespace, '#pop'),
            (r'\S', Keyword.Type),
            (r'\s', Whitespace),
        ],
        'functiondefres': [
            include('common'),
            (r'\n(\s*)', check_indent2),
            (r'^(?=\S)', Whitespace, '#pop:2'),
            (r'[!{}()\[\],:;.#]', Punctuation),
            (r'\|', Punctuation, 'functiondefclasses'),
            (r'\S', Keyword.Type),
            (r'\s', Whitespace),
        ],
        'functiondefclasses': [
            include('common'),
            (r'\n(\s*)', check_indent3),
            (r'^(?=\S)', Whitespace, '#pop:3'),
            (r'[,&]', Punctuation),
            (r'\[', Punctuation, 'functiondefuniquneq'),
            (r'[\w`$()=\-<>~*\^|+&%/{}\[\]@]', Name.Function, 'functionname'),
            (r'\s+', Whitespace),
        ],
        'functiondefuniquneq': [
            include('common'),
            (r'[a-z]+', Keyword.Type),
            (r'\s+', Whitespace),
            (r'<=|,', Punctuation),
            (r'\]', Punctuation, '#pop')
        ],
        'functionname': [
            include('common'),
            (r'[\w`$()=\-<>~*\^|+&%/]+', Name.Function),
            (r'(?=\{\|)', Punctuation, 'genericfunction'),
            default('#pop'),
        ]
    }
