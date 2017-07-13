# -*- coding: utf-8 -*-
# $Id: ru.py 7125 2011-09-16 18:36:18Z milde $
# Author: Roman Suzi <rnd@onego.ru>
# Copyright: This module has been placed in the public domain.

# New language mappings are welcome.  Before doing a new translation, please
# read <http://docutils.sf.net/docs/howto/i18n.html>.  Two files must be
# translated for each language: one in docutils/languages, the other in
# docutils/parsers/rst/languages.

"""
Russian-language mappings for language-dependent features of Docutils.
"""

__docformat__ = 'reStructuredText'

labels = {
      u'abstract': u'Аннотация',
      u'address': u'Адрес',
      u'attention': u'Внимание!',
      u'author': u'Автор',
      u'authors': u'Авторы',
      u'caution': u'Осторожно!',
      u'contact': u'Контакт',
      u'contents': u'Содержание',
      u'copyright': u'Права копирования',
      u'danger': u'ОПАСНО!',
      u'date': u'Дата',
      u'dedication': u'Посвящение',
      u'error': u'Ошибка',
      u'hint': u'Совет',
      u'important': u'Важно',
      u'note': u'Примечание',
      u'organization': u'Организация',
      u'revision': u'Редакция',
      u'status': u'Статус',
      u'tip': u'Подсказка',
      u'version': u'Версия',
      u'warning': u'Предупреждение'}
"""Mapping of node class name to label text."""

bibliographic_fields = {
      u'аннотация': u'abstract',
      u'адрес': u'address',
      u'автор': u'author',
      u'авторы': u'authors',
      u'контакт': u'contact',
      u'права копирования': u'copyright',
      u'дата': u'date',
      u'посвящение': u'dedication',
      u'организация': u'organization',
      u'редакция': u'revision',
      u'статус': u'status',
      u'версия': u'version'}
"""Russian (lowcased) to canonical name mapping for bibliographic fields."""

author_separators =  [';', ',']
"""List of separator strings for the 'Authors' bibliographic field. Tried in
order."""
