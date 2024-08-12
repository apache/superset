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
import { render, waitFor } from 'spec/helpers/testing-library';
import TagsList, { TagsListProps } from './TagsList';

const testTags = [
  {
    name: 'example-tag1',
    id: 1,
  },
  {
    name: 'example-tag2',
    id: 2,
  },
  {
    name: 'example-tag3',
    id: 3,
  },
  {
    name: 'example-tag4',
    id: 4,
  },
  {
    name: 'example-tag5',
    id: 5,
  },
];

const mockedProps: TagsListProps = {
  tags: testTags,
  onDelete: undefined,
  maxTags: 5,
};

const getElementsByClassName = (className: string) =>
  document.querySelectorAll(className)! as NodeListOf<HTMLElement>;

const findAllTags = () => waitFor(() => getElementsByClassName('.ant-tag'));

test('should render', () => {
  const { container } = render(<TagsList {...mockedProps} />);
  expect(container).toBeInTheDocument();
});

test('should render 5 elements', async () => {
  render(<TagsList {...mockedProps} />);
  const tagsListItems = await findAllTags();
  expect(tagsListItems).toHaveLength(5);
  expect(tagsListItems[0]).toHaveTextContent(testTags[0].name);
  expect(tagsListItems[1]).toHaveTextContent(testTags[1].name);
  expect(tagsListItems[2]).toHaveTextContent(testTags[2].name);
  expect(tagsListItems[3]).toHaveTextContent(testTags[3].name);
  expect(tagsListItems[4]).toHaveTextContent(testTags[4].name);
});

test('should render 3 elements when maxTags is set to 3', async () => {
  render(<TagsList {...mockedProps} maxTags={3} />);
  const tagsListItems = await findAllTags();
  expect(tagsListItems).toHaveLength(3);
  expect(tagsListItems[2]).toHaveTextContent('+3...');
});
