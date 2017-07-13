# -*- coding: utf-8 -*-
# $Id: ja.py 7119 2011-09-02 13:00:23Z milde $
# Author: David Goodger <goodger@python.org>
# Copyright: This module has been placed in the public domain.

# New language mappings are welcome.  Before doing a new translation, please
# read <http://docutils.sf.net/docs/howto/i18n.html>.  Two files must be
# translated for each language: one in docutils/languages, the other in
# docutils/parsers/rst/languages.

"""
Japanese-language mappings for language-dependent features of
reStructuredText.
"""

__docformat__ = 'reStructuredText'

# Corrections to these translations are welcome!
# 間違いがあれば、どうぞ正しい翻訳を教えて下さい。

directives = {
    # language-dependent: fixed
    u'注目': 'attention',
    u'注意': 'caution',
    u'code (translation required)': 'code',
    u'危険': 'danger',
    u'エラー': 'error',
    u'ヒント': 'hint',
    u'重要': 'important',
    u'備考': 'note',
    u'通報': 'tip',
    u'警告': 'warning',
    u'戒告': 'admonition',
    u'サイドバー': 'sidebar',
    u'トピック': 'topic',
    u'ラインブロック': 'line-block',
    u'パーズドリテラル': 'parsed-literal',
    u'ルブリック': 'rubric',
    u'エピグラフ': 'epigraph',
    u'題言': 'epigraph',
    u'ハイライト': 'highlights',
    u'見所': 'highlights',
    u'プルクオート': 'pull-quote',
    u'合成': 'compound',
    u'コンテナー': 'container',
    u'容器': 'container',
    u'表': 'table',
    u'csv表': 'csv-table',
    u'リスト表': 'list-table',
    #u'質問': 'questions',
    #u'問答': 'questions',
    #u'faq': 'questions',
    u'math (translation required)': 'math',
    u'メタ': 'meta',
    #u'イメージマプ': 'imagemap',
    u'イメージ': 'image',
    u'画像': 'image',
    u'フィグア': 'figure',
    u'図版': 'figure',
    u'インクルード': 'include',
    u'含む': 'include',
    u'組み込み': 'include',
    u'生': 'raw',
    u'原': 'raw',
    u'換える': 'replace',
    u'取り換える': 'replace',
    u'掛け替える': 'replace',
    u'ユニコード': 'unicode',
    u'日付': 'date',
    u'クラス': 'class',
    u'ロール': 'role',
    u'役': 'role',
    u'ディフォルトロール': 'default-role',
    u'既定役': 'default-role',
    u'タイトル': 'title',
    u'題': 'title',                    # 題名　件名
    u'目次': 'contents',
    u'節数': 'sectnum',
    u'ヘッダ': 'header',
    u'フッタ': 'footer',
    #u'脚注': 'footnotes',             # 脚註?
    #u'サイテーション': 'citations',　　　# 出典　引証　引用
    u'ターゲットノート': 'target-notes', # 的注　的脚注
    }
"""Japanese name to registered (in directives/__init__.py) directive name
mapping."""

roles = {
    # language-dependent: fixed
    u'略': 'abbreviation',
    u'頭字語': 'acronym',
    u'code (translation required)': 'code',
    u'インデックス': 'index',
    u'索引': 'index',
    u'添字': 'subscript',
    u'下付': 'subscript',
    u'下': 'subscript',
    u'上付': 'superscript',
    u'上': 'superscript',
    u'題参照': 'title-reference',
    u'pep参照': 'pep-reference',
    u'rfc参照': 'rfc-reference',
    u'強調': 'emphasis',
    u'強い': 'strong',
    u'リテラル': 'literal',
    u'整形済み': 'literal',
    u'math (translation required)': 'math',
    u'名付参照': 'named-reference',
    u'無名参照': 'anonymous-reference',
    u'脚注参照': 'footnote-reference',
    u'出典参照': 'citation-reference',
    u'代入参照': 'substitution-reference',
    u'的': 'target',
    u'uri参照': 'uri-reference',
    u'uri': 'uri-reference',
    u'url': 'uri-reference',
    u'生': 'raw',}
"""Mapping of Japanese role names to canonical role names for interpreted
text."""
