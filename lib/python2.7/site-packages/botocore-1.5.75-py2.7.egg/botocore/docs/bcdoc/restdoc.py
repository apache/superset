# Copyright 2012-2013 Amazon.com, Inc. or its affiliates. All Rights Reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License"). You
# may not use this file except in compliance with the License. A copy of
# the License is located at
#
#     http://aws.amazon.com/apache2.0/
#
# or in the "license" file accompanying this file. This file is
# distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF
# ANY KIND, either express or implied. See the License for the specific
# language governing permissions and limitations under the License.
import logging

from botocore.compat import OrderedDict
from botocore.docs.bcdoc.docstringparser import DocStringParser
from botocore.docs.bcdoc.style import ReSTStyle

LOG = logging.getLogger('bcdocs')


class ReSTDocument(object):

    def __init__(self, target='man'):
        self.style = ReSTStyle(self)
        self.target = target
        self.parser = DocStringParser(self)
        self.keep_data = True
        self.do_translation = False
        self.translation_map = {}
        self.hrefs = {}
        self._writes = []
        self._last_doc_string = None

    def _write(self, s):
        if self.keep_data and s is not None:
            self._writes.append(s)

    def write(self, content):
        """
        Write content into the document.
        """
        self._write(content)

    def writeln(self, content):
        """
        Write content on a newline.
        """
        self._write('%s%s\n' % (self.style.spaces(), content))

    def peek_write(self):
        """
        Returns the last content written to the document without
        removing it from the stack.
        """
        return self._writes[-1]

    def pop_write(self):
        """
        Removes and returns the last content written to the stack.
        """
        return self._writes.pop()

    def push_write(self, s):
        """
        Places new content on the stack.
        """
        self._writes.append(s)

    def getvalue(self):
        """
        Returns the current content of the document as a string.
        """
        if self.hrefs:
            self.style.new_paragraph()
            for refname, link in self.hrefs.items():
                self.style.link_target_definition(refname, link)
        return ''.join(self._writes).encode('utf-8')

    def translate_words(self, words):
        return [self.translation_map.get(w, w) for w in words]

    def handle_data(self, data):
        if data and self.keep_data:
            self._write(data)

    def include_doc_string(self, doc_string):
        if doc_string:
            try:
                start = len(self._writes)
                self.parser.feed(doc_string)
                self.parser.close()
                end = len(self._writes)
                self._last_doc_string = (start, end)
            except Exception:
                LOG.debug('Error parsing doc string', exc_info=True)
                LOG.debug(doc_string)

    def remove_last_doc_string(self):
        # Removes all writes inserted by last doc string
        if self._last_doc_string is not None:
            start, end = self._last_doc_string
            del self._writes[start:end]


class DocumentStructure(ReSTDocument):
    def __init__(self, name, section_names=None, target='man', context=None):
        """Provides a Hierarichial structure to a ReSTDocument

        You can write to it similiar to as you can to a ReSTDocument but
        has an innate structure for more orginaztion and abstraction.

        :param name: The name of the document
        :param section_names: A list of sections to be included
            in the document.
        :param target: The target documentation of the Document structure
        :param context: A dictionary of data to store with the strucuture. These
            are only stored per section not the entire structure.
        """
        super(DocumentStructure, self).__init__(target=target)
        self._name = name
        self._structure = OrderedDict()
        self._path = [self._name]
        self._context = {}
        if context is not None:
            self._context = context
        if section_names is not None:
            self._generate_structure(section_names)

    @property
    def name(self):
        """The name of the document structure"""
        return self._name

    @property
    def path(self):
        """
        A list of where to find a particular document structure in the
        overlying document structure.
        """
        return self._path

    @path.setter
    def path(self, value):
        self._path = value

    @property
    def available_sections(self):
        return list(self._structure)

    @property
    def context(self):
        return self._context

    def _generate_structure(self, section_names):
        for section_name in section_names:
            self.add_new_section(section_name)

    def add_new_section(self, name, context=None):
        """Adds a new section to the current document structure

        This document structure will be considered a section to the
        current document structure but will in itself be an entirely
        new document structure that can be written to and have sections
        as well

        :param name: The name of the section.
        :param context: A dictionary of data to store with the strucuture. These
            are only stored per section not the entire structure.
        :rtype: DocumentStructure
        :returns: A new document structure to add to but lives as a section
            to the document structure it was instantiated from.
        """
        # Add a new section
        section = self.__class__(name=name, target=self.target,
                                 context=context)
        section.path = self.path + [name]
        # Indent the section apporpriately as well
        section.style.indentation = self.style.indentation
        section.translation_map = self.translation_map
        section.hrefs = self.hrefs
        self._structure[name] = section
        return section

    def get_section(self, name):
        """Retrieve a section"""
        return self._structure[name]

    def delete_section(self, name):
        """Delete a section"""
        del self._structure[name]

    def flush_structure(self):
        """Flushes a doc structure to a ReSTructed string

        The document is flushed out in a DFS style where sections and their
        subsections' values are added to the string as they are visited.
        """
        # We are at the root flush the links at the beginning of the
        # document
        if len(self.path) == 1:
            if self.hrefs:
                self.style.new_paragraph()
                for refname, link in self.hrefs.items():
                    self.style.link_target_definition(refname, link)
        value = self.getvalue()
        for name, section in self._structure.items():
            value += section.flush_structure()
        return value

    def getvalue(self):
        return ''.join(self._writes).encode('utf-8')

    def remove_all_sections(self):
        self._structure = OrderedDict()

    def clear_text(self):
        self._writes = []
