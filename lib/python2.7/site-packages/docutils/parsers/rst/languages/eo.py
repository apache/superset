# $Id: eo.py 7119 2011-09-02 13:00:23Z milde $
# Author: Marcelo Huerta San Martin <richieadler@users.sourceforge.net>
# Copyright: This module has been placed in the public domain.

# New language mappings are welcome.  Before doing a new translation, please
# read <http://docutils.sf.net/docs/howto/i18n.html>.  Two files must be
# translated for each language: one in docutils/languages, the other in
# docutils/parsers/rst/languages.

"""
Esperanto-language mappings for language-dependent features of
reStructuredText.
"""

__docformat__ = 'reStructuredText'


directives = {
      # language-dependent: fixed
      u'atentu': 'attention',
      u'zorgu': 'caution',
      u'code (translation required)': 'code',
      u'dangxero': 'danger',
      u'dan\u011dero': 'danger',
      u'eraro': 'error',
      u'spuro': 'hint',
      u'grava': 'important',
      u'noto': 'note',
      u'helpeto': 'tip',
      u'averto': 'warning',
      u'admono': 'admonition',
      u'flankteksto': 'sidebar',
      u'temo': 'topic',
      u'linea-bloko': 'line-block',
      u'analizota-literalo': 'parsed-literal',
      u'rubriko': 'rubric',
      u'epigrafo': 'epigraph',
      u'elstarajxoj': 'highlights',
      u'elstara\u0135oj': 'highlights',
      u'ekstera-citajxo': 'pull-quote',
      u'ekstera-cita\u0135o': 'pull-quote',
      u'kombinajxo': 'compound',
      u'kombina\u0135o': 'compound',
      u'tekstingo': 'container',
      u'enhavilo': 'container',
      #'questions': 'questions',
      #'qa': 'questions',
      #'faq': 'questions',
      u'tabelo': 'table',
      u'tabelo-vdk': 'csv-table', # "valoroj disigitaj per komoj"
      u'tabelo-csv': 'csv-table',
      u'tabelo-lista': 'list-table',
      u'meta': 'meta',
      'math (translation required)': 'math',
      #'imagemap': 'imagemap',
      u'bildo': 'image',
      u'figuro': 'figure',
      u'inkludi': 'include',
      u'senanaliza': 'raw',
      u'anstatauxi': 'replace',
      u'anstata\u016di': 'replace',
      u'unicode': 'unicode',
      u'dato': 'date',
      u'klaso': 'class',
      u'rolo': 'role',
      u'preterlasita-rolo': 'default-role',
      u'titolo': 'title',
      u'enhavo': 'contents',
      u'seknum': 'sectnum',
      u'sekcia-numerado': 'sectnum',
      u'kapsekcio': 'header',
      u'piedsekcio': 'footer',
      #'footnotes': 'footnotes',
      #'citations': 'citations',
      u'celaj-notoj': 'target-notes',
      u'restructuredtext-test-directive': 'restructuredtext-test-directive'}
"""Esperanto name to registered (in directives/__init__.py) directive name
mapping."""

roles = {
    # language-dependent: fixed
    u'mallongigo': 'abbreviation',
    u'mall': 'abbreviation',
    u'komenclitero': 'acronym',
    u'kl': 'acronym',
    u'code (translation required)': 'code',
    u'indekso': 'index',
    u'i': 'index',
    u'subskribo': 'subscript',
    u'sub': 'subscript',
    u'supraskribo': 'superscript',
    u'sup': 'superscript',
    u'titola-referenco': 'title-reference',
    u'titolo': 'title-reference',
    u't': 'title-reference',
    u'pep-referenco': 'pep-reference',
    u'pep': 'pep-reference',
    u'rfc-referenco': 'rfc-reference',
    u'rfc': 'rfc-reference',
    u'emfazo': 'emphasis',
    u'forta': 'strong',
    u'litera': 'literal',
    'math (translation required)': 'math',
    u'nomita-referenco': 'named-reference',
    u'nenomita-referenco': 'anonymous-reference',
    u'piednota-referenco': 'footnote-reference',
    u'citajxo-referenco': 'citation-reference',
    u'cita\u0135o-referenco': 'citation-reference',
    u'anstatauxa-referenco': 'substitution-reference',
    u'anstata\u016da-referenco': 'substitution-reference',
    u'celo': 'target',
    u'uri-referenco': 'uri-reference',
    u'uri': 'uri-reference',
    u'url': 'uri-reference',
    u'senanaliza': 'raw',
}
"""Mapping of Esperanto role names to canonical role names for interpreted text.
"""
