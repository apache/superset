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
    within(avatarGroup as HTMLElement).getByText('BJ'),
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

test('orders subjects by type and label without mutating input', () => {
  const unorderedSubjects = [
    { id: 1, label: 'Beta Role', type: SubjectType.Role },
    { id: 2, label: 'Zen Group', type: SubjectType.Group },
    { id: 3, label: 'Ada User', type: SubjectType.User },
    { id: 4, label: 'Alpha Group', type: SubjectType.Group },
    { id: 5, label: 'Bob User', type: SubjectType.User },
    { id: 6, label: 'Alpha Role', type: SubjectType.Role },
  ];

  const { container } = render(
    <SubjectPile subjects={unorderedSubjects} maxCount={6} />,
  );

  expect(
    [...container.querySelectorAll('.ant-avatar-string')].map(
      avatar => avatar.textContent,
    ),
  ).toEqual(['AU', 'BU', 'AG', 'ZG', 'AR', 'BR']);
  expect(
    [...container.querySelectorAll<HTMLElement>('.ant-avatar')].map(
      avatar => avatar.style.zIndex,
    ),
  ).toEqual(['6', '5', '4', '3', '2', '1']);
  expect(unorderedSubjects.map(subject => subject.label)).toEqual([
    'Beta Role',
    'Zen Group',
    'Ada User',
    'Alpha Group',
    'Bob User',
    'Alpha Role',
  ]);
});

test('uses square avatars for group subjects', () => {
  const { container } = render(<SubjectPile subjects={[subjects[2]]} />);

  expect(container.querySelector('.ant-avatar')).toHaveClass(
    'ant-avatar-square',
  );
});

test('uses octagon avatars for role subjects', () => {
  const { container } = render(<SubjectPile subjects={[subjects[1]]} />);
  const avatar = container.querySelector('.ant-avatar');

  expect(avatar).not.toHaveClass('ant-avatar-square');
  expect(avatar).toHaveStyleRule('clip-path', /polygon/);
  expect(avatar).toHaveStyleRule('border-radius', '0');
});
