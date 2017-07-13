# Copyright 2012-2015 Amazon.com, Inc. or its affiliates. All Rights Reserved.
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


DOC_EVENTS = {
    'doc-breadcrumbs': '.%s',
    'doc-title': '.%s',
    'doc-description': '.%s',
    'doc-synopsis-start': '.%s',
    'doc-synopsis-option': '.%s.%s',
    'doc-synopsis-end': '.%s',
    'doc-options-start': '.%s',
    'doc-option': '.%s.%s',
    'doc-option-example': '.%s.%s',
    'doc-options-end': '.%s',
    'doc-examples': '.%s',
    'doc-output': '.%s',
    'doc-subitems-start': '.%s',
    'doc-subitem': '.%s.%s',
    'doc-subitems-end': '.%s',
    'doc-relateditems-start': '.%s',
    'doc-relateditem': '.%s.%s',
    'doc-relateditems-end': '.%s'
    }


def generate_events(session, help_command):
    # Now generate the documentation events
    session.emit('doc-breadcrumbs.%s' % help_command.event_class,
                 help_command=help_command)
    session.emit('doc-title.%s' % help_command.event_class,
                 help_command=help_command)
    session.emit('doc-description.%s' % help_command.event_class,
                 help_command=help_command)
    session.emit('doc-synopsis-start.%s' % help_command.event_class,
                 help_command=help_command)
    if help_command.arg_table:
        for arg_name in help_command.arg_table:
            # An argument can set an '_UNDOCUMENTED' attribute
            # to True to indicate a parameter that exists
            # but shouldn't be documented.  This can be used
            # for backwards compatibility of deprecated arguments.
            if getattr(help_command.arg_table[arg_name],
                       '_UNDOCUMENTED', False):
                continue
            session.emit(
                'doc-synopsis-option.%s.%s' % (help_command.event_class,
                                               arg_name),
                arg_name=arg_name, help_command=help_command)
    session.emit('doc-synopsis-end.%s' % help_command.event_class,
                 help_command=help_command)
    session.emit('doc-options-start.%s' % help_command.event_class,
                 help_command=help_command)
    if help_command.arg_table:
        for arg_name in help_command.arg_table:
            if getattr(help_command.arg_table[arg_name],
                       '_UNDOCUMENTED', False):
                continue
            session.emit('doc-option.%s.%s' % (help_command.event_class,
                                               arg_name),
                         arg_name=arg_name, help_command=help_command)
            session.emit('doc-option-example.%s.%s' %
                         (help_command.event_class, arg_name),
                         arg_name=arg_name, help_command=help_command)
    session.emit('doc-options-end.%s' % help_command.event_class,
                 help_command=help_command)
    session.emit('doc-subitems-start.%s' % help_command.event_class,
                 help_command=help_command)
    if help_command.command_table:
        for command_name in sorted(help_command.command_table.keys()):
            if hasattr(help_command.command_table[command_name],
                       '_UNDOCUMENTED'):
                continue
            session.emit('doc-subitem.%s.%s'
                         % (help_command.event_class, command_name),
                         command_name=command_name,
                         help_command=help_command)
    session.emit('doc-subitems-end.%s' % help_command.event_class,
                 help_command=help_command)
    session.emit('doc-examples.%s' % help_command.event_class,
                 help_command=help_command)
    session.emit('doc-output.%s' % help_command.event_class,
                 help_command=help_command)
    session.emit('doc-relateditems-start.%s' % help_command.event_class,
                 help_command=help_command)
    if help_command.related_items:
        for related_item in sorted(help_command.related_items):
            session.emit('doc-relateditem.%s.%s'
                         % (help_command.event_class, related_item),
                         help_command=help_command,
                         related_item=related_item)
    session.emit('doc-relateditems-end.%s' % help_command.event_class,
                 help_command=help_command)
