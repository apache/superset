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
import { SubjectSelectLabel } from '.';
import { SubjectType } from 'src/types/Subject';

export default {
  title: 'Features/Subjects/SubjectSelectLabel',
  component: SubjectSelectLabel,
  parameters: {
    docs: {
      description: {
        component:
          'Inline label for subject select options and tags. Shows the name with a parenthesized type and detail suffix.',
      },
    },
  },
};

export const InteractiveSubjectSelectLabel = (args: {
  label: string;
  type?: SubjectType;
  secondaryLabel?: string;
}) => <SubjectSelectLabel {...args} />;

InteractiveSubjectSelectLabel.args = {
  label: 'Alice Smith',
  type: SubjectType.User,
  secondaryLabel: 'alice@example.com',
};

InteractiveSubjectSelectLabel.argTypes = {
  label: {
    description: 'The primary display name of the subject',
    control: { type: 'text' },
  },
  type: {
    description: 'Subject type',
    control: {
      type: 'inline-radio',
      options: [SubjectType.User, SubjectType.Role, SubjectType.Group],
      labels: {
        [SubjectType.User]: 'User',
        [SubjectType.Role]: 'Role',
        [SubjectType.Group]: 'Group',
      },
    },
  },
  secondaryLabel: {
    description: 'Secondary detail (email for users, description for groups)',
    control: { type: 'text' },
  },
};

export const UserWithEmail = () => (
  <SubjectSelectLabel
    label="Alice Smith"
    type={SubjectType.User}
    secondaryLabel="alice@example.com"
  />
);

export const RoleSubject = () => (
  <SubjectSelectLabel label="Alpha" type={SubjectType.Role} />
);

export const GroupWithDescription = () => (
  <SubjectSelectLabel
    label="Data Engineering"
    type={SubjectType.Group}
    secondaryLabel="data-engineering"
  />
);

export const SubjectGallery = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    <SubjectSelectLabel
      label="Alice Smith"
      type={SubjectType.User}
      secondaryLabel="alice@example.com"
    />
    <SubjectSelectLabel
      label="Bob Johnson"
      type={SubjectType.User}
      secondaryLabel="bob@example.com"
    />
    <SubjectSelectLabel label="Alpha" type={SubjectType.Role} />
    <SubjectSelectLabel label="Gamma" type={SubjectType.Role} />
    <SubjectSelectLabel
      label="Data Engineering"
      type={SubjectType.Group}
      secondaryLabel="data-engineering"
    />
  </div>
);

SubjectGallery.parameters = {
  actions: { disable: true },
  controls: { disable: true },
};
