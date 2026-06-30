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
import { render, within } from 'spec/helpers/testing-library';
import { SubjectType } from 'src/types/Subject';
import { SubjectPile } from '.';

const subjects = [
  { id: 1, label: 'Alice Smith', type: SubjectType.User },
  { id: 2, label: 'Admin', type: SubjectType.Role },
  { id: 3, label: 'Engineering', type: SubjectType.Group },
  { id: 4, label: 'Bob Jones', type: SubjectType.User },
];

test('renders subjects and overflow avatars using compact size', () => {
  const { container } = render(
    <SubjectPile subjects={subjects} maxCount={2} />,
  );

  const avatarGroup = container.querySelector('.ant-avatar-group');
  expect(avatarGroup).toBeInTheDocument();
  expect(
    within(avatarGroup as HTMLElement).getByText('AS'),
  ).toBeInTheDocument();
  expect(
    within(avatarGroup as HTMLElement).getByText('AD'),
  ).toBeInTheDocument();
  expect(
    within(avatarGroup as HTMLElement).getByText('+2'),
  ).toBeInTheDocument();

  const avatars = container.querySelectorAll('.ant-avatar');
  expect(avatars).toHaveLength(3);
  avatars.forEach(avatar => {
    expect(avatar).toHaveClass('ant-avatar-sm');
  });
});

test('uses square avatars for role subjects', () => {
  const { container } = render(<SubjectPile subjects={[subjects[1]]} />);

  expect(container.querySelector('.ant-avatar')).toHaveClass(
    'ant-avatar-square',
  );
});
