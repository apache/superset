# $Id$
# Author: Robert Wojciechowicz <rw@smsnet.pl>
# Copyright: This module has been placed in the public domain.

# New language mappings are welcome.  Before doing a new translation, please
# read <http://docutils.sf.net/docs/howto/i18n.html>.  Two files must be
# translated for each language: one in docutils/languages, the other in
# docutils/parsers/rst/languages.

"""
Polish-language mappings for language-dependent features of
reStructuredText.
"""

__docformat__ = 'reStructuredText'


directives = {
      # language-dependent: fixed
      u'uwaga': 'attention',
      u'ostro\u017cnie': 'caution',
      u'code (translation required)': 'code',
      u'niebezpiecze\u0144stwo': 'danger',
      u'b\u0142\u0105d': 'error',
      u'wskaz\u00f3wka': 'hint',
      u'wa\u017cne': 'important',
      u'przypis': 'note',
      u'rada': 'tip',
      u'ostrze\u017cenie': 'warning',
      u'upomnienie': 'admonition',
      u'ramka': 'sidebar',
      u'temat': 'topic',
      u'blok-linii': 'line-block',
      u'sparsowany-litera\u0142': 'parsed-literal',
      u'rubryka': 'rubric',
      u'epigraf': 'epigraph',
      u'highlights': 'highlights',  # FIXME no polish equivalent?
      u'pull-quote': 'pull-quote',  # FIXME no polish equivalent?
      u'z\u0142o\u017cony': 'compound',
      u'kontener': 'container',
      #'questions': 'questions',
      u'tabela': 'table',
      u'tabela-csv': 'csv-table',
      u'tabela-listowa': 'list-table',
      #'qa': 'questions',
      #'faq': 'questions',
      u'meta': 'meta',
      'math (translation required)': 'math',
      #'imagemap': 'imagemap',
      u'obraz': 'image',
      u'rycina': 'figure',
      u'do\u0142\u0105cz': 'include',
      u'surowe': 'raw',
      u'zast\u0105p': 'replace',
      u'unikod': 'unicode',
      u'data': 'date',
      u'klasa': 'class',
      u'rola': 'role',
      u'rola-domy\u015blna': 'default-role',
      u'tytu\u0142': 'title',
      u'tre\u015b\u0107': 'contents',
      u'sectnum': 'sectnum',
      u'numeracja-sekcji': 'sectnum',
      u'nag\u0142\u00f3wek': 'header',
      u'stopka': 'footer',
      #'footnotes': 'footnotes',
      #'citations': 'citations',
      u'target-notes': 'target-notes',  # FIXME no polish equivalent?
      u'restructuredtext-test-directive': 'restructuredtext-test-directive'}
"""Polish name to registered (in directives/__init__.py) directive name
mapping."""

roles = {
    # language-dependent: fixed
    u'skr\u00f3t': 'abbreviation',
    u'akronim': 'acronym',
    u'code (translation required)': 'code',
    u'indeks': 'index',
    u'indeks-dolny': 'subscript',
    u'indeks-g\u00f3rny': 'superscript',
    u'referencja-tytu\u0142': 'title-reference',
    u'referencja-pep': 'pep-reference',
    u'referencja-rfc': 'rfc-reference',
    u'podkre\u015blenie': 'emphasis',
    u'wyt\u0142uszczenie': 'strong',
    u'dos\u0142ownie': 'literal',
    'math (translation required)': 'math',
    u'referencja-nazwana': 'named-reference',
    u'referencja-anonimowa': 'anonymous-reference',
    u'referencja-przypis': 'footnote-reference',
    u'referencja-cytat': 'citation-reference',
    u'referencja-podstawienie': 'substitution-reference',
    u'cel': 'target',
    u'referencja-uri': 'uri-reference',
    u'uri': 'uri-reference',
    u'url': 'uri-reference',
    u'surowe': 'raw',}
"""Mapping of Polish role names to canonical role names for interpreted text.
"""
    

                 
