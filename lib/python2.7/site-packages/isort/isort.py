"""isort.py.

Exposes a simple library to sort through imports within Python code

usage:
    SortImports(file_name)
or:
    sorted = SortImports(file_contents=file_contents).output

Copyright (C) 2013  Timothy Edmund Crosley

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
documentation files (the "Software"), to deal in the Software without restriction, including without limitation
the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and
to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or
substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED
TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF
CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.

"""
from __future__ import absolute_import, division, print_function, unicode_literals

import copy
import io
import itertools
import os
import re
import sys
from collections import namedtuple
from datetime import datetime
from difflib import unified_diff
from fnmatch import fnmatch
from glob import glob

from . import settings
from .natural import nsorted
from .pie_slice import OrderedDict, OrderedSet, input, itemsview

KNOWN_SECTION_MAPPING = {
    'STDLIB': 'STANDARD_LIBRARY',
    'FUTURE': 'FUTURE_LIBRARY',
    'FIRSTPARTY': 'FIRST_PARTY',
    'THIRDPARTY': 'THIRD_PARTY',
}


class SortImports(object):
    incorrectly_sorted = False
    skipped = False

    def __init__(self, file_path=None, file_contents=None, write_to_stdout=False, check=False,
                 show_diff=False, settings_path=None, ask_to_apply=False, **setting_overrides):
        if not settings_path and file_path:
            settings_path = os.path.dirname(os.path.abspath(file_path))
        settings_path = settings_path or os.getcwd()

        self.config = settings.from_path(settings_path).copy()
        for key, value in itemsview(setting_overrides):
            access_key = key.replace('not_', '').lower()
            # The sections config needs to retain order and can't be converted to a set.
            if access_key != 'sections' and type(self.config.get(access_key)) in (list, tuple):
                if key.startswith('not_'):
                    self.config[access_key] = list(set(self.config[access_key]).difference(value))
                else:
                    self.config[access_key] = list(set(self.config[access_key]).union(value))
            else:
                self.config[key] = value

        if self.config['force_alphabetical_sort']:
            self.config.update({'force_alphabetical_sort_within_sections': True,
                                'no_sections': True,
                                'lines_between_types': 1,
                                'from_first': True})

        indent = str(self.config['indent'])
        if indent.isdigit():
            indent = " " * int(indent)
        else:
            indent = indent.strip("'").strip('"')
            if indent.lower() == "tab":
                indent = "\t"
        self.config['indent'] = indent

        self.place_imports = {}
        self.import_placements = {}
        self.remove_imports = [self._format_simplified(removal) for removal in self.config['remove_imports']]
        self.add_imports = [self._format_natural(addition) for addition in self.config['add_imports']]
        self._section_comments = ["# " + value for key, value in itemsview(self.config) if
                                  key.startswith('import_heading') and value]

        self.file_encoding = 'utf-8'
        file_name = file_path
        self.file_path = file_path or ""
        if file_path:
            file_path = os.path.abspath(file_path)
            if settings.should_skip(file_path, self.config):
                self.skipped = True
                if self.config['verbose']:
                    print("WARNING: {0} was skipped as it's listed in 'skip' setting"
                          " or matches a glob in 'skip_glob' setting".format(file_path))
                file_contents = None
            elif not file_contents:
                self.file_path = file_path
                self.file_encoding = coding_check(file_path)
                with io.open(file_path, encoding=self.file_encoding) as file_to_import_sort:
                    file_contents = file_to_import_sort.read()

        if file_contents is None or ("isort:" + "skip_file") in file_contents:
            return

        self.in_lines = file_contents.split("\n")
        self.original_length = len(self.in_lines)
        if (self.original_length > 1 or self.in_lines[:1] not in ([], [""])) or self.config['force_adds']:
            for add_import in self.add_imports:
                self.in_lines.append(add_import)
        self.number_of_lines = len(self.in_lines)

        self.out_lines = []
        self.comments = {'from': {}, 'straight': {}, 'nested': {}, 'above': {'straight': {}, 'from': {}}}
        self.imports = OrderedDict()
        self.as_map = {}

        section_names = self.config['sections']
        self.sections = namedtuple('Sections', section_names)(*[name for name in section_names])
        for section in itertools.chain(self.sections, self.config['forced_separate']):
            self.imports[section] = {'straight': OrderedSet(), 'from': OrderedDict()}

        self.known_patterns = []
        for placement in reversed(self.sections):
            known_placement = KNOWN_SECTION_MAPPING.get(placement, placement)
            config_key = 'known_{0}'.format(known_placement.lower())
            known_patterns = self.config.get(config_key, [])
            for known_pattern in known_patterns:
                self.known_patterns.append((re.compile('^' + known_pattern.replace('*', '.*').replace('?', '.?') + '$'),
                                            placement))

        self.index = 0
        self.import_index = -1
        self._first_comment_index_start = -1
        self._first_comment_index_end = -1
        self._parse()
        if self.import_index != -1:
            self._add_formatted_imports()

        self.length_change = len(self.out_lines) - self.original_length
        while self.out_lines and self.out_lines[-1].strip() == "":
            self.out_lines.pop(-1)
        self.out_lines.append("")

        self.output = "\n".join(self.out_lines)
        if self.config['atomic']:
            try:
                compile(self._strip_top_comments(self.out_lines), self.file_path, 'exec', 0, 1)
            except SyntaxError:
                self.output = file_contents
                self.incorrectly_sorted = True
                try:
                    compile(self._strip_top_comments(self.in_lines), self.file_path, 'exec', 0, 1)
                    print("ERROR: {0} isort would have introduced syntax errors, please report to the project!". \
                          format(self.file_path))
                except SyntaxError:
                    print("ERROR: {0} File contains syntax errors.".format(self.file_path))

                return
        if check:
            check_output = self.output
            check_against = file_contents
            if self.config['ignore_whitespace']:
                check_output = check_output.replace("\n", "").replace(" ", "")
                check_against = check_against.replace("\n", "").replace(" ", "")

            if check_output == check_against:
                if self.config['verbose']:
                    print("SUCCESS: {0} Everything Looks Good!".format(self.file_path))
                return

            print("ERROR: {0} Imports are incorrectly sorted.".format(self.file_path))
            self.incorrectly_sorted = True
        if show_diff or self.config['show_diff']:
            self._show_diff(file_contents)
        elif write_to_stdout:
            sys.stdout.write(self.output)
        elif file_name and not check:
            if ask_to_apply:
                if self.output == file_contents:
                    return
                self._show_diff(file_contents)
                answer = None
                while answer not in ('yes', 'y', 'no', 'n', 'quit', 'q'):
                    answer = input("Apply suggested changes to '{0}' [y/n/q]?".format(self.file_path)).lower()
                    if answer in ('no', 'n'):
                        return
                    if answer in ('quit', 'q'):
                        sys.exit(1)
            with io.open(self.file_path, encoding=self.file_encoding, mode='w') as output_file:
                output_file.write(self.output)

    def _show_diff(self, file_contents):
        for line in unified_diff(
            file_contents.splitlines(1),
            self.output.splitlines(1),
            fromfile=self.file_path + ':before',
            tofile=self.file_path + ':after',
            fromfiledate=str(datetime.fromtimestamp(os.path.getmtime(self.file_path))
                             if self.file_path else datetime.now()),
            tofiledate=str(datetime.now())
        ):
            sys.stdout.write(line)

    @staticmethod
    def _strip_top_comments(lines):
        """Strips # comments that exist at the top of the given lines"""
        lines = copy.copy(lines)
        while lines and lines[0].startswith("#"):
            lines = lines[1:]
        return "\n".join(lines)

    def place_module(self, module_name):
        """Tries to determine if a module is a python std import, third party import, or project code:

        if it can't determine - it assumes it is project code

        """
        for forced_separate in self.config['forced_separate']:
            # Ensure all forced_separate patterns will match to end of string
            path_glob = forced_separate
            if not forced_separate.endswith('*'):
                path_glob = '%s*' % forced_separate

            if fnmatch(module_name, path_glob) or fnmatch(module_name, '.' + path_glob):
                return forced_separate

        if module_name.startswith("."):
            return self.sections.LOCALFOLDER

        # Try to find most specific placement instruction match (if any)
        parts = module_name.split('.')
        module_names_to_check = ['.'.join(parts[:first_k]) for first_k in range(len(parts), 0, -1)]
        for module_name_to_check in module_names_to_check:
            for pattern, placement in self.known_patterns:
                if pattern.match(module_name_to_check):
                    return placement

        # Use a copy of sys.path to avoid any unintended modifications
        # to it - e.g. `+=` used below will change paths in place and
        # if not copied, consequently sys.path, which will grow unbounded
        # with duplicates on every call to this method.
        paths = list(sys.path)
        virtual_env = self.config.get('virtual_env') or os.environ.get('VIRTUAL_ENV')
        virtual_env_src = False
        if virtual_env:
            paths += [path for path in glob('{0}/lib/python*/site-packages'.format(virtual_env))
                      if path not in paths]
            paths += [path for path in glob('{0}/src/*'.format(virtual_env)) if os.path.isdir(path)]
            virtual_env_src = '{0}/src/'.format(virtual_env)

        # handle case-insensitive paths on windows
        stdlib_lib_prefix = os.path.normcase(get_stdlib_path())

        for prefix in paths:
            module_path = "/".join((prefix, module_name.replace(".", "/")))
            package_path = "/".join((prefix, module_name.split(".")[0]))
            is_module = (exists_case_sensitive(module_path + ".py") or
                         exists_case_sensitive(module_path + ".so"))
            is_package = exists_case_sensitive(package_path) and os.path.isdir(package_path)
            if is_module or is_package:
                if ('site-packages' in prefix or 'dist-packages' in prefix or
                        (virtual_env and virtual_env_src in prefix)):
                    return self.sections.THIRDPARTY
                elif os.path.normcase(prefix).startswith(stdlib_lib_prefix):
                    return self.sections.STDLIB
                else:
                    return self.config['default_section']

        return self.config['default_section']

    def _get_line(self):
        """Returns the current line from the file while incrementing the index."""
        line = self.in_lines[self.index]
        self.index += 1
        return line

    @staticmethod
    def _import_type(line):
        """If the current line is an import line it will return its type (from or straight)"""
        if "isort:skip" in line:
            return
        elif line.startswith('import '):
            return "straight"
        elif line.startswith('from '):
            return "from"

    def _at_end(self):
        """returns True if we are at the end of the file."""
        return self.index == self.number_of_lines

    @staticmethod
    def _module_key(module_name, config, sub_imports=False, ignore_case=False):
        prefix = ""
        if ignore_case:
            module_name = str(module_name).lower()
        else:
            module_name = str(module_name)

        if sub_imports and config['order_by_type']:
            if module_name.isupper() and len(module_name) > 1:
                prefix = "A"
            elif module_name[0:1].isupper():
                prefix = "B"
            else:
                prefix = "C"
        module_name = module_name.lower()
        return "{0}{1}{2}".format(module_name in config['force_to_top'] and "A" or "B", prefix,
                                  config['length_sort'] and (str(len(module_name)) + ":" + module_name) or module_name)

    def _add_comments(self, comments, original_string=""):
        """
            Returns a string with comments added
        """
        return comments and "{0}  # {1}".format(self._strip_comments(original_string)[0],
                                                "; ".join(comments)) or original_string

    def _wrap(self, line):
        """
            Returns an import wrapped to the specified line-length, if possible.
        """
        wrap_mode = self.config['multi_line_output']
        if len(line) > self.config['line_length'] and wrap_mode != settings.WrapModes.NOQA:
            for splitter in ("import", ".", "as"):
                exp = r"\b" + re.escape(splitter) + r"\b"
                if re.search(exp, line) and not line.strip().startswith(splitter):
                    line_parts = re.split(exp, line)
                    next_line = []
                    while (len(line) + 2) > (self.config['wrap_length'] or self.config['line_length']) and line_parts:
                        next_line.append(line_parts.pop())
                        line = splitter.join(line_parts)
                    if not line:
                        line = next_line.pop()

                    cont_line = self._wrap(self.config['indent'] + splitter.join(next_line).lstrip())
                    if self.config['use_parentheses']:
                        output = "{0}{1} (\n{2}{3}{4})".format(
                            line, splitter, cont_line,
                            "," if self.config['include_trailing_comma'] else "",
                            "\n" if wrap_mode in (
                                settings.WrapModes.VERTICAL_HANGING_INDENT,
                                settings.WrapModes.VERTICAL_GRID_GROUPED,
                            ) else "")
                        lines = output.split('\n')
                        if '  #' in lines[-1] and lines[-1].endswith(')'):
                            line, comment = lines[-1].split('  #', 1)
                            lines[-1] = line + ')  #' + comment[:-1]
                        return '\n'.join(lines)
                    return "{0}{1} \\\n{2}".format(line, splitter, cont_line)
        elif len(line) > self.config['line_length'] and wrap_mode == settings.WrapModes.NOQA:
            if "# NOQA" not in line:
                return "{0}  # NOQA".format(line)

        return line

    def _add_straight_imports(self, straight_modules, section, section_output):
        for module in straight_modules:
            if module in self.remove_imports:
                continue

            if module in self.as_map:
                import_definition = "import {0} as {1}".format(module, self.as_map[module])
            else:
                import_definition = "import {0}".format(module)

            comments_above = self.comments['above']['straight'].pop(module, None)
            if comments_above:
                section_output.extend(comments_above)
            section_output.append(self._add_comments(self.comments['straight'].get(module), import_definition))

    def _add_from_imports(self, from_modules, section, section_output, ignore_case):
        for module in from_modules:
            if module in self.remove_imports:
                continue

            import_start = "from {0} import ".format(module)
            from_imports = self.imports[section]['from'][module]
            from_imports = nsorted(from_imports, key=lambda key: self._module_key(key, self.config, True, ignore_case))
            if self.remove_imports:
                from_imports = [line for line in from_imports if not "{0}.{1}".format(module, line) in
                                self.remove_imports]

            for from_import in copy.copy(from_imports):
                submodule = module + "." + from_import
                import_as = self.as_map.get(submodule, False)
                if import_as:
                    import_definition = "{0} as {1}".format(from_import, import_as)
                    if self.config['combine_as_imports'] and not ("*" in from_imports and
                                                                    self.config['combine_star']):
                        from_imports[from_imports.index(from_import)] = import_definition
                    else:
                        import_statement = import_start + import_definition
                        force_grid_wrap = self.config['force_grid_wrap']
                        comments = self.comments['straight'].get(submodule)
                        import_statement = self._add_comments(comments, self._wrap(import_statement))
                        from_imports.remove(from_import)
                        section_output.append(import_statement)


            if from_imports:
                comments = self.comments['from'].pop(module, ())
                if "*" in from_imports and self.config['combine_star']:
                    import_statement = self._wrap(self._add_comments(comments, "{0}*".format(import_start)))
                elif self.config['force_single_line']:
                    import_statements = []
                    for from_import in from_imports:
                        single_import_line = self._add_comments(comments, import_start + from_import)
                        comment = self.comments['nested'].get(module, {}).pop(from_import, None)
                        if comment:
                            single_import_line += "{0} {1}".format(comments and ";" or "  #", comment)
                        import_statements.append(self._wrap(single_import_line))
                        comments = None
                    import_statement = "\n".join(import_statements)
                else:
                    star_import = False
                    if "*" in from_imports:
                        section_output.append(self._add_comments(comments, "{0}*".format(import_start)))
                        from_imports.remove('*')
                        star_import = True
                        comments = None

                    for from_import in copy.copy(from_imports):
                        comment = self.comments['nested'].get(module, {}).pop(from_import, None)
                        if comment:
                            single_import_line = self._add_comments(comments, import_start + from_import)
                            single_import_line += "{0} {1}".format(comments and ";" or "  #", comment)
                            above_comments = self.comments['above']['from'].pop(module, None)
                            if above_comments:
                                section_output.extend(above_comments)
                            section_output.append(self._wrap(single_import_line))
                            from_imports.remove(from_import)
                            comments = None

                    if star_import:
                        import_statement = import_start + (", ").join(from_imports)
                    else:
                        import_statement = self._add_comments(comments, import_start + (", ").join(from_imports))
                    if not from_imports:
                        import_statement = ""

                    do_multiline_reformat = False

                    force_grid_wrap = self.config['force_grid_wrap']
                    if force_grid_wrap and len(from_imports) >= force_grid_wrap:
                        do_multiline_reformat = True

                    if len(import_statement) > self.config['line_length'] and len(from_imports) > 1:
                        do_multiline_reformat = True

                    # If line too long AND have imports AND we are NOT using GRID or VERTICAL wrap modes
                    if (len(import_statement) > self.config['line_length'] and len(from_imports) > 0 and
                            self.config['multi_line_output'] not in (1, 0)):
                        do_multiline_reformat = True

                    if do_multiline_reformat:
                        import_statement = self._multi_line_reformat(import_start, from_imports, comments)
                    if not do_multiline_reformat and len(import_statement) > self.config['line_length']:
                        import_statement = self._wrap(import_statement)

                if import_statement:
                    above_comments = self.comments['above']['from'].pop(module, None)
                    if above_comments:
                        section_output.extend(above_comments)
                    section_output.append(import_statement)

    def _multi_line_reformat(self, import_start, from_imports, comments):
        output_mode = settings.WrapModes._fields[self.config['multi_line_output']].lower()
        formatter = getattr(self, "_output_" + output_mode, self._output_grid)
        dynamic_indent = " " * (len(import_start) + 1)
        indent = self.config['indent']
        line_length = self.config['wrap_length'] or self.config['line_length']
        import_statement = formatter(import_start, copy.copy(from_imports),
                                     dynamic_indent, indent, line_length, comments)
        if self.config['balanced_wrapping']:
            lines = import_statement.split("\n")
            line_count = len(lines)
            if len(lines) > 1:
                minimum_length = min([len(line) for line in lines[:-1]])
            else:
                minimum_length = 0
            new_import_statement = import_statement
            while (len(lines[-1]) < minimum_length and
                    len(lines) == line_count and line_length > 10):
                import_statement = new_import_statement
                line_length -= 1
                new_import_statement = formatter(import_start, copy.copy(from_imports),
                                                dynamic_indent, indent, line_length, comments)
                lines = new_import_statement.split("\n")
        if import_statement.count('\n') == 0:
            return self._wrap(import_statement)
        return import_statement

    def _add_formatted_imports(self):
        """Adds the imports back to the file.

        (at the index of the first import) sorted alphabetically and split between groups

        """
        sort_ignore_case = self.config['force_alphabetical_sort_within_sections']
        sections = itertools.chain(self.sections, self.config['forced_separate'])

        if self.config['no_sections']:
            self.imports['no_sections'] = {'straight': [], 'from': {}}
            for section in sections:
                self.imports['no_sections']['straight'].extend(self.imports[section].get('straight', []))
                self.imports['no_sections']['from'].update(self.imports[section].get('from', {}))
            sections = ('no_sections', )

        output = []
        for section in sections:
            straight_modules = self.imports[section]['straight']
            straight_modules = nsorted(straight_modules, key=lambda key: self._module_key(key, self.config))
            from_modules = self.imports[section]['from']
            from_modules = nsorted(from_modules, key=lambda key: self._module_key(key, self.config))

            section_output = []
            if self.config['from_first']:
                self._add_from_imports(from_modules, section, section_output, sort_ignore_case)
                if self.config['lines_between_types'] and from_modules and straight_modules:
                    section_output.extend([''] * self.config['lines_between_types'])
                self._add_straight_imports(straight_modules, section, section_output)
            else:
                self._add_straight_imports(straight_modules, section, section_output)
                if self.config['lines_between_types'] and from_modules and straight_modules:
                    section_output.extend([''] * self.config['lines_between_types'])
                self._add_from_imports(from_modules, section, section_output, sort_ignore_case)

            if self.config['force_sort_within_sections']:
                def by_module(line):
                    section = 'B'
                    if line.startswith('#'):
                        return 'AA'

                    line = re.sub('^from ', '', line)
                    line = re.sub('^import ', '', line)
                    if line.split(' ')[0] in self.config['force_to_top']:
                        section = 'A'
                    if not self.config['order_by_type']:
                        line = line.lower()
                    return '{0}{1}'.format(section, line)
                section_output = nsorted(section_output, key=by_module)

            if section_output:
                section_name = section
                if section_name in self.place_imports:
                    self.place_imports[section_name] = section_output
                    continue

                section_title = self.config.get('import_heading_' + str(section_name).lower(), '')
                if section_title:
                    section_comment = "# {0}".format(section_title)
                    if not section_comment in self.out_lines[0:1] and not section_comment in self.in_lines[0:1]:
                        section_output.insert(0, section_comment)
                output += section_output + ([''] * self.config['lines_between_sections'])

        while [character.strip() for character in output[-1:]] == [""]:
            output.pop()

        output_at = 0
        if self.import_index < self.original_length:
            output_at = self.import_index
        elif self._first_comment_index_end != -1 and self._first_comment_index_start <= 2:
            output_at = self._first_comment_index_end
        self.out_lines[output_at:0] = output

        imports_tail = output_at + len(output)
        while [character.strip() for character in self.out_lines[imports_tail: imports_tail + 1]] == [""]:
            self.out_lines.pop(imports_tail)

        if len(self.out_lines) > imports_tail:
            next_construct = ""
            self._in_quote = False
            tail = self.out_lines[imports_tail:]
            for index, line in enumerate(tail):
                if not self._skip_line(line) and line.strip():
                    if line.strip().startswith("#") and len(tail) > (index + 1) and tail[index + 1].strip():
                        continue
                    next_construct = line
                    break

            if self.config['lines_after_imports'] != -1:
                self.out_lines[imports_tail:0] = ["" for line in range(self.config['lines_after_imports'])]
            elif next_construct.startswith("def") or next_construct.startswith("class") or \
               next_construct.startswith("@") or next_construct.startswith("async def"):
                self.out_lines[imports_tail:0] = ["", ""]
            else:
                self.out_lines[imports_tail:0] = [""]

        if self.place_imports:
            new_out_lines = []
            for index, line in enumerate(self.out_lines):
                new_out_lines.append(line)
                if line in self.import_placements:
                    new_out_lines.extend(self.place_imports[self.import_placements[line]])
                    if len(self.out_lines) <= index or self.out_lines[index + 1].strip() != "":
                        new_out_lines.append("")
            self.out_lines = new_out_lines

    def _output_grid(self, statement, imports, white_space, indent, line_length, comments):
        statement += "(" + imports.pop(0)
        while imports:
            next_import = imports.pop(0)
            next_statement = self._add_comments(comments, statement + ", " + next_import)
            if len(next_statement.split("\n")[-1]) + 1 > line_length:
                lines = ['{0}{1}'.format(white_space, next_import.split(" ")[0])]
                for part in next_import.split(" ")[1:]:
                    new_line = '{0} {1}'.format(lines[-1], part)
                    if len(new_line) + 1 > line_length:
                        lines.append('{0}{1}'.format(white_space, part))
                    else:
                        lines[-1] = new_line
                next_import = '\n'.join(lines)
                statement = (self._add_comments(comments, "{0},".format(statement)) +
                             "\n{0}".format(next_import))
                comments = None
            else:
                statement += ", " + next_import
        return statement + ("," if self.config['include_trailing_comma'] else "") + ")"

    def _output_vertical(self, statement, imports, white_space, indent, line_length, comments):
        first_import = self._add_comments(comments, imports.pop(0) + ",") + "\n" + white_space
        return "{0}({1}{2}{3})".format(
            statement,
            first_import,
            (",\n" + white_space).join(imports),
            "," if self.config['include_trailing_comma'] else "",
        )

    def _output_hanging_indent(self, statement, imports, white_space, indent, line_length, comments):
        statement += imports.pop(0)
        while imports:
            next_import = imports.pop(0)
            next_statement = self._add_comments(comments, statement + ", " + next_import)
            if len(next_statement.split("\n")[-1]) + 3 > line_length:
                next_statement = (self._add_comments(comments, "{0}, \\".format(statement)) +
                                  "\n{0}{1}".format(indent, next_import))
                comments = None
            statement = next_statement
        return statement

    def _output_vertical_hanging_indent(self, statement, imports, white_space, indent, line_length, comments):
        return "{0}({1}\n{2}{3}{4}\n)".format(
            statement,
            self._add_comments(comments),
            indent,
            (",\n" + indent).join(imports),
            "," if self.config['include_trailing_comma'] else "",
         )

    def _output_vertical_grid_common(self, statement, imports, white_space, indent, line_length, comments):
        statement += self._add_comments(comments, "(") + "\n" + indent + imports.pop(0)
        while imports:
            next_import = imports.pop(0)
            next_statement = "{0}, {1}".format(statement, next_import)
            if len(next_statement.split("\n")[-1]) + 1 > line_length:
                next_statement = "{0},\n{1}{2}".format(statement, indent, next_import)
            statement = next_statement
        if self.config['include_trailing_comma']:
            statement += ','
        return statement

    def _output_vertical_grid(self, statement, imports, white_space, indent, line_length, comments):
        return self._output_vertical_grid_common(statement, imports, white_space, indent, line_length, comments) + ")"

    def _output_vertical_grid_grouped(self, statement, imports, white_space, indent, line_length, comments):
        return self._output_vertical_grid_common(statement, imports, white_space, indent, line_length, comments) + "\n)"

    def _output_noqa(self, statement, imports, white_space, indent, line_length, comments):
        retval = '{0}{1}'.format(statement, ', '.join(imports))
        comment_str = ' '.join(comments)
        if comments:
            if len(retval) + 4 + len(comment_str) <= line_length:
                return '{0}  # {1}'.format(retval, comment_str)
        else:
            if len(retval) <= line_length:
                return retval
        if comments:
            if "NOQA" in comments:
                return '{0}  # {1}'.format(retval, comment_str)
            else:
                return '{0}  # NOQA {1}'.format(retval, comment_str)
        else:
            return '{0}  # NOQA'.format(retval)

    @staticmethod
    def _strip_comments(line, comments=None):
        """Removes comments from import line."""
        if comments is None:
            comments = []

        new_comments = False
        comment_start = line.find("#")
        if comment_start != -1:
            comments.append(line[comment_start + 1:].strip())
            new_comments = True
            line = line[:comment_start]

        return line, comments, new_comments

    @staticmethod
    def _format_simplified(import_line):
        import_line = import_line.strip()
        if import_line.startswith("from "):
            import_line = import_line.replace("from ", "")
            import_line = import_line.replace(" import ", ".")
        elif import_line.startswith("import "):
            import_line = import_line.replace("import ", "")

        return import_line

    @staticmethod
    def _format_natural(import_line):
        import_line = import_line.strip()
        if not import_line.startswith("from ") and not import_line.startswith("import "):
            if not "." in import_line:
                return "import {0}".format(import_line)
            parts = import_line.split(".")
            end = parts.pop(-1)
            return "from {0} import {1}".format(".".join(parts), end)

        return import_line

    def _skip_line(self, line):
        skip_line = self._in_quote
        if self.index == 1 and line.startswith("#"):
            self._in_top_comment = True
            return True
        elif self._in_top_comment:
            if not line.startswith("#"):
                self._in_top_comment = False
                self._first_comment_index_end = self.index - 1

        if '"' in line or "'" in line:
            index = 0
            if self._first_comment_index_start == -1 and (line.startswith('"') or line.startswith("'")):
                self._first_comment_index_start = self.index
            while index < len(line):
                if line[index] == "\\":
                    index += 1
                elif self._in_quote:
                    if line[index:index + len(self._in_quote)] == self._in_quote:
                        self._in_quote = False
                        if self._first_comment_index_end < self._first_comment_index_start:
                            self._first_comment_index_end = self.index
                elif line[index] in ("'", '"'):
                    long_quote = line[index:index + 3]
                    if long_quote in ('"""', "'''"):
                        self._in_quote = long_quote
                        index += 2
                    else:
                        self._in_quote = line[index]
                elif line[index] == "#":
                    break
                index += 1

        return skip_line or self._in_quote or self._in_top_comment

    def _strip_syntax(self, import_string):
        import_string = import_string.replace("_import", "[[i]]")
        for remove_syntax in ['\\', '(', ')', ',']:
            import_string = import_string.replace(remove_syntax, " ")
        import_list = import_string.split()
        for key in ('from', 'import'):
            if key in import_list:
                import_list.remove(key)
        import_string = ' '.join(import_list)
        import_string = import_string.replace("[[i]]", "_import")
        return import_string.replace("{ ", "{|").replace(" }", "|}")

    def _parse(self):
        """Parses a python file taking out and categorizing imports."""
        self._in_quote = False
        self._in_top_comment = False
        while not self._at_end():
            line = self._get_line()
            statement_index = self.index
            skip_line = self._skip_line(line)

            if line in self._section_comments and not skip_line:
                if self.import_index == -1:
                    self.import_index = self.index - 1
                continue

            if "isort:imports-" in line and line.startswith("#"):
                section = line.split("isort:imports-")[-1].split()[0].upper()
                self.place_imports[section] = []
                self.import_placements[line] = section

            if ";" in line:
                for part in (part.strip() for part in line.split(";")):
                    if part and not part.startswith("from ") and not part.startswith("import "):
                        skip_line = True

            import_type = self._import_type(line)
            if not import_type or skip_line:
                self.out_lines.append(line)
                continue

            for line in (line.strip() for line in line.split(";")):
                import_type = self._import_type(line)
                if not import_type:
                    self.out_lines.append(line)
                    continue

                line = line.replace("\t", " ").replace('import*', 'import *')
                if self.import_index == -1:
                    self.import_index = self.index - 1

                nested_comments = {}
                import_string, comments, new_comments = self._strip_comments(line)
                stripped_line = [part for part in self._strip_syntax(import_string).strip().split(" ") if part]

                if import_type == "from" and len(stripped_line) == 2 and stripped_line[1] != "*" and new_comments:
                    nested_comments[stripped_line[-1]] = comments[0]

                if "(" in line.split("#")[0] and not self._at_end():
                    while not line.strip().endswith(")") and not self._at_end():
                        line, comments, new_comments = self._strip_comments(self._get_line(), comments)
                        stripped_line = self._strip_syntax(line).strip()
                        if import_type == "from" and stripped_line and not " " in stripped_line and new_comments:
                            nested_comments[stripped_line] = comments[-1]
                        import_string += "\n" + line
                else:
                    while line.strip().endswith("\\"):
                        line, comments, new_comments = self._strip_comments(self._get_line(), comments)
                        stripped_line = self._strip_syntax(line).strip()
                        if import_type == "from" and stripped_line and not " " in stripped_line and new_comments:
                            nested_comments[stripped_line] = comments[-1]
                        if import_string.strip().endswith(" import") or line.strip().startswith("import "):
                            import_string += "\n" + line
                        else:
                            import_string = import_string.rstrip().rstrip("\\") + " " + line.lstrip()

                if import_type == "from":
                    import_string = import_string.replace("import(", "import (")
                    parts = import_string.split(" import ")
                    from_import = parts[0].split(" ")
                    import_string = " import ".join([from_import[0] + " " + "".join(from_import[1:])] + parts[1:])

                imports = [item.replace("{|", "{ ").replace("|}", " }") for item in
                           self._strip_syntax(import_string).split()]
                if "as" in imports and (imports.index('as') + 1) < len(imports):
                    while "as" in imports:
                        index = imports.index('as')
                        if import_type == "from":
                            module = imports[0] + "." + imports[index - 1]
                            self.as_map[module] = imports[index + 1]
                        else:
                            module = imports[index - 1]
                            self.as_map[module] = imports[index + 1]
                        if not self.config['combine_as_imports']:
                            self.comments['straight'][module] = comments
                            comments = []
                        del imports[index:index + 2]
                if import_type == "from":
                    import_from = imports.pop(0)
                    placed_module = self.place_module(import_from)
                    if placed_module == '':
                        print(
                            "WARNING: could not place module {0} of line {1} --"
                            " Do you need to define a default section?".format(import_from, line)
                        )
                    root = self.imports[placed_module][import_type]
                    for import_name in imports:
                        associated_comment = nested_comments.get(import_name)
                        if associated_comment:
                            self.comments['nested'].setdefault(import_from, {})[import_name] = associated_comment
                            comments.pop(comments.index(associated_comment))
                    if comments:
                        self.comments['from'].setdefault(import_from, []).extend(comments)

                    if len(self.out_lines) > max(self.import_index, self._first_comment_index_end + 1, 1) - 1:
                        last = self.out_lines and self.out_lines[-1].rstrip() or ""
                        while (last.startswith("#") and not last.endswith('"""') and not last.endswith("'''") and not
                               'isort:imports-' in last):
                            self.comments['above']['from'].setdefault(import_from, []).insert(0, self.out_lines.pop(-1))
                            if len(self.out_lines) > max(self.import_index - 1, self._first_comment_index_end + 1, 1) - 1:
                                last = self.out_lines[-1].rstrip()
                            else:
                                last = ""
                        if statement_index - 1 == self.import_index:
                            self.import_index -= len(self.comments['above']['from'].get(import_from, []))

                    if root.get(import_from, False):
                        root[import_from].update(imports)
                    else:
                        root[import_from] = OrderedSet(imports)
                else:
                    for module in imports:
                        if comments:
                            self.comments['straight'][module] = comments
                            comments = None

                        if len(self.out_lines) > max(self.import_index, self._first_comment_index_end + 1, 1) - 1:

                            last = self.out_lines and self.out_lines[-1].rstrip() or ""
                            while (last.startswith("#") and not last.endswith('"""') and not last.endswith("'''") and
                                   not 'isort:imports-' in last):
                                self.comments['above']['straight'].setdefault(module, []).insert(0,
                                                                                                 self.out_lines.pop(-1))
                                if len(self.out_lines) > 0:
                                    last = self.out_lines[-1].rstrip()
                                else:
                                    last = ""
                            if self.index - 1 == self.import_index:
                                self.import_index -= len(self.comments['above']['straight'].get(module, []))
                        placed_module = self.place_module(module)
                        if placed_module == '':
                            print(
                                "WARNING: could not place module {0} of line {1} --"
                                " Do you need to define a default section?".format(import_from, line)
                            )
                        self.imports[placed_module][import_type].add(module)


def coding_check(fname, default='utf-8'):

    # see https://www.python.org/dev/peps/pep-0263/
    pattern = re.compile(br'coding[:=]\s*([-\w.]+)')

    coding = default
    with io.open(fname, 'rb') as f:
        for line_number, line in enumerate(f, 1):
            groups = re.findall(pattern, line)
            if groups:
                coding = groups[0].decode('ascii')
                break
            if line_number > 2:
                break

    return coding


def get_stdlib_path():
    """Returns the path to the standard lib for the current path installation.

    This function can be dropped and "sysconfig.get_paths()" used directly once Python 2.6 support is dropped.
    """
    if sys.version_info >= (2, 7):
        import sysconfig
        return sysconfig.get_paths()['stdlib']
    else:
        return os.path.join(sys.prefix, 'lib')


def exists_case_sensitive(path):
    """
    Returns if the given path exists and also matches the case on Windows.

    When finding files that can be imported, it is important for the cases to match because while
    file os.path.exists("module.py") and os.path.exists("MODULE.py") both return True on Windows, Python
    can only import using the case of the real file.
    """
    result = os.path.exists(path)
    if sys.platform.startswith('win') and result:
        directory, basename = os.path.split(path)
        result = basename in os.listdir(directory)
    return result
