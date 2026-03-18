/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import { EditableTitle } from '.';
import type { EditableTitleProps } from './types';

export default {
  title: 'Components/EditableTitle',
  component: EditableTitle,
};

export const InteractiveEditableTitle = (props: EditableTitleProps) => (
  <EditableTitle {...props} />
);

InteractiveEditableTitle.args = {
  canEdit: true,
  editing: false,
  emptyText: 'Empty text',
  noPermitTooltip: 'Not permitted',
  showTooltip: true,
  title: 'Title',
  defaultTitle: 'Default title',
  placeholder: 'Placeholder',
  certifiedBy: '',
  certificationDetails: '',
  maxWidth: 100,
  autoSize: true,
};

InteractiveEditableTitle.argTypes = {
  canEdit: {
    description: 'Whether the title can be edited.',
  },
  editing: {
    description: 'Whether the title is currently in edit mode.',
  },
  emptyText: {
    description: 'Text to display when title is empty.',
  },
  noPermitTooltip: {
    description: 'Tooltip shown when user lacks edit permission.',
  },
  showTooltip: {
    description: 'Whether to show tooltip on hover.',
  },
  title: {
    description: 'The title text to display.',
  },
  defaultTitle: {
    description: 'Default title when none is provided.',
  },
  placeholder: {
    description: 'Placeholder text when editing.',
  },
  certifiedBy: {
    description: 'Name of person/team who certified this item.',
  },
  certificationDetails: {
    description: 'Additional certification details or description.',
  },
  maxWidth: {
    description: 'Maximum width of the title in pixels.',
  },
  autoSize: {
    description: 'Whether to auto-size based on content.',
  },
  onSaveTitle: { action: 'onSaveTitle' },
};

InteractiveEditableTitle.parameters = {
  actions: {
    disable: true,
  },
  docs: {
    description: {
      story: 'An editable title component with optional certification badge.',
    },
    liveExample: `function Demo() {
  return (
    <EditableTitle
      title="My Dashboard"
      canEdit
      showTooltip
      certifiedBy="Data Team"
      certificationDetails="Verified Q1 2024"
      onSaveTitle={(newTitle) => console.log('Saved:', newTitle)}
    />
  );
}`,
  },
};
