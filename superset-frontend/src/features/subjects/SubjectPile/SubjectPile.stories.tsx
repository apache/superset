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
import { SubjectType } from 'src/types/Subject';
import { SubjectPile } from '.';

export default {
  title: 'SubjectPile',
  component: SubjectPile,
};

const MOCK_SUBJECTS = [
  { id: 1, label: 'Alice Smith', type: SubjectType.User },
  { id: 2, label: 'Bob Jones', type: SubjectType.User },
  { id: 3, label: 'Admin', type: SubjectType.Role },
  { id: 4, label: 'Engineering', type: SubjectType.Group },
  { id: 5, label: 'Carol White', type: SubjectType.User },
  { id: 6, label: 'Editor', type: SubjectType.Role },
  { id: 7, label: 'Data Science', type: SubjectType.Group },
];

export const InteractiveSubjectPile = {
  render: (args: { maxCount: number }) => (
    <SubjectPile subjects={MOCK_SUBJECTS} maxCount={args.maxCount} />
  ),
  args: {
    maxCount: 4,
  },
  argTypes: {
    maxCount: {
      control: { type: 'range', min: 1, max: 7 },
      description: 'Maximum avatars to show before collapsing',
    },
  },
};

export const UsersOnly = () => (
  <SubjectPile
    subjects={MOCK_SUBJECTS.filter(s => s.type === SubjectType.User)}
  />
);

export const RolesOnly = () => (
  <SubjectPile
    subjects={MOCK_SUBJECTS.filter(s => s.type === SubjectType.Role)}
  />
);

export const GroupsOnly = () => (
  <SubjectPile
    subjects={MOCK_SUBJECTS.filter(s => s.type === SubjectType.Group)}
  />
);

export const MixedSubjects = () => <SubjectPile subjects={MOCK_SUBJECTS} />;

export const Empty = () => <SubjectPile subjects={[]} />;

export const SingleUser = () => <SubjectPile subjects={[MOCK_SUBJECTS[0]]} />;
