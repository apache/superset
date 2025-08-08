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
import { TagsList, TagsListProps } from '.';

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

const setup = (props: TagsListProps = mockedProps) =>
  render(<TagsList {...props} />, { useRouter: true });

test('should render', () => {
  const { container } = setup();
  expect(container).toBeInTheDocument();
});

test('should render 5 elements', async () => {
  setup();
  const tagsListItems = await findAllTags();
  expect(tagsListItems).toHaveLength(5);
  expect(tagsListItems[0]).toHaveTextContent(testTags[0].name);
  expect(tagsListItems[1]).toHaveTextContent(testTags[1].name);
  expect(tagsListItems[2]).toHaveTextContent(testTags[2].name);
  expect(tagsListItems[3]).toHaveTextContent(testTags[3].name);
  expect(tagsListItems[4]).toHaveTextContent(testTags[4].name);
});

test('should render 3 elements when maxTags is set to 3', async () => {
  setup({ ...mockedProps, maxTags: 3 });
  const tagsListItems = await findAllTags();
  expect(tagsListItems).toHaveLength(3);
  expect(tagsListItems[2]).toHaveTextContent('+3...');
});

describe('Tag type filtering', () => {
  test('should render only custom type tags (type: 1)', async () => {
    const mixedTypeTags = [
      { name: 'custom-tag', type: 1, id: 1 }, // Custom - should show
      { name: 'type:chart', type: 2, id: 2 }, // Type - should be filtered out
      { name: 'owner:admin', type: 3, id: 3 }, // Owner - should be filtered out
      { name: 'another-custom', type: 1, id: 4 }, // Custom - should show
    ];

    // Filter tags like ChartList does - only custom types
    const filteredTags = mixedTypeTags.filter(tag =>
      tag.type
        ? tag.type === 1 || String(tag.type) === 'TagTypes.custom'
        : true,
    );

    setup({ tags: filteredTags, maxTags: 5 });
    const tagsListItems = await findAllTags();

    // Should only show 2 custom tags, sorted alphabetically
    expect(tagsListItems).toHaveLength(2);
    expect(tagsListItems[0]).toHaveTextContent('another-custom');
    expect(tagsListItems[1]).toHaveTextContent('custom-tag');
  });

  test('should show tags when type is undefined (fallback case)', async () => {
    const undefinedTypeTags = [
      { name: 'legacy-tag', id: 1 }, // No type property - should show due to fallback
      { name: 'custom-tag', type: 1, id: 2 }, // Custom - should show
      { name: 'system-tag', type: 2, id: 3 }, // System - should be filtered out
    ];

    // Apply ChartList filtering logic - undefined type defaults to true
    const filteredTags = undefinedTypeTags.filter(tag =>
      tag.type
        ? tag.type === 1 || String(tag.type) === 'TagTypes.custom'
        : true,
    );

    setup({ tags: filteredTags, maxTags: 5 });
    const tagsListItems = await findAllTags();

    // Should show both tags, sorted alphabetically
    expect(tagsListItems).toHaveLength(2);
    expect(tagsListItems[0]).toHaveTextContent('custom-tag');
    expect(tagsListItems[1]).toHaveTextContent('legacy-tag');
  });

  test('should handle legacy TagTypes.custom string format', async () => {
    const legacyFormatTags = [
      { name: 'legacy-custom', type: 'TagTypes.custom', id: 1 }, // Legacy string format - should show
      { name: 'modern-custom', type: 1, id: 2 }, // Modern enum - should show
      { name: 'other-type', type: 'TagTypes.other', id: 3 }, // Other legacy type - should be filtered out
    ];

    // Apply ChartList filtering logic - supports both numeric and legacy string
    const filteredTags = legacyFormatTags.filter(tag =>
      tag.type
        ? tag.type === 1 || String(tag.type) === 'TagTypes.custom'
        : true,
    );

    setup({ tags: filteredTags, maxTags: 5 });
    const tagsListItems = await findAllTags();

    // Should show both custom formats, sorted alphabetically
    expect(tagsListItems).toHaveLength(2);
    expect(tagsListItems[0]).toHaveTextContent('legacy-custom');
    expect(tagsListItems[1]).toHaveTextContent('modern-custom');
  });

  test('should show empty list when all tags are filtered out', async () => {
    const nonCustomTags = [
      { name: 'type:chart', type: 2, id: 1 }, // Type tag
      { name: 'owner:admin', type: 3, id: 2 }, // Owner tag
      { name: 'favoritedBy:user', type: 4, id: 3 }, // FavoritedBy tag
    ];

    // Apply ChartList filtering - all should be filtered out
    const filteredTags = nonCustomTags.filter(tag =>
      tag.type
        ? tag.type === 1 || String(tag.type) === 'TagTypes.custom'
        : true,
    );

    setup({ tags: filteredTags, maxTags: 5 });

    // Should render container but with no tags
    const container = document.querySelector('.tag-list');
    expect(container).toBeInTheDocument();

    // No tags should be rendered
    const tagsListItems = document.querySelectorAll('.ant-tag');
    expect(tagsListItems).toHaveLength(0);
  });

  test('should handle mixed scenarios with truncation', async () => {
    const largeMixedTagSet = [
      { name: 'custom-1', type: 1, id: 1 }, // Custom - should show
      { name: 'system-1', type: 2, id: 2 }, // System - filtered out
      { name: 'custom-2', type: 1, id: 3 }, // Custom - should show
      { name: 'legacy-custom', type: 'TagTypes.custom', id: 4 }, // Legacy custom - should show
      { name: 'custom-3', type: 1, id: 5 }, // Custom - should show
      { name: 'owner-tag', type: 3, id: 6 }, // Owner - filtered out
      { name: 'custom-4', type: 1, id: 7 }, // Custom - should show (but truncated)
    ];

    // Apply ChartList filtering - should get 5 custom tags
    const filteredTags = largeMixedTagSet.filter(tag =>
      tag.type
        ? tag.type === 1 || String(tag.type) === 'TagTypes.custom'
        : true,
    );

    // Set maxTags to 3 to test truncation of filtered results
    setup({ tags: filteredTags, maxTags: 3 });
    const tagsListItems = await findAllTags();

    // Should show 3 tags: 2 custom tags (alphabetically sorted) + 1 "+3..." truncation indicator
    expect(tagsListItems).toHaveLength(3);
    expect(tagsListItems[0]).toHaveTextContent('custom-1');
    expect(tagsListItems[1]).toHaveTextContent('custom-2');
    expect(tagsListItems[2]).toHaveTextContent('+3...');
  });
});
