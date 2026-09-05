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
import { useContext } from 'react';
import { render, screen, userEvent } from 'spec/helpers/testing-library';
import { DndItemType } from 'src/explore/components/DndItemType';
import { DatasourcePanelDndItem } from 'src/explore/components/DatasourcePanel/types';
import DndSelectLabel, {
  DndSelectLabelProps,
  resolveCanDrop,
} from 'src/explore/components/controls/DndColumnSelectControl/DndSelectLabel';
import ExploreContainer, { DropzoneContext } from '../../ExploreContainer';

const defaultProps: DndSelectLabelProps = {
  name: 'Column',
  accept: 'Column' as DndItemType,
  onDrop: jest.fn(),
  canDrop: () => false,
  valuesRenderer: () => <span />,
  ghostButtonText: 'Drop columns here or click',
  onClickGhostButton: jest.fn(),
};
const MockChildren = () => {
  const [zones] = useContext(DropzoneContext);
  return (
    <>
      {Object.keys(zones).map(key => (
        <div key={key} data-test={`mock-result-${key}`}>
          {String(
            zones[key]({
              value: { column_name: 'test' },
              type: DndItemType.Column,
            }),
          )}
        </div>
      ))}
    </>
  );
};

test('renders with default props', () => {
  render(<DndSelectLabel {...defaultProps} />, { useDndKit: true });
  expect(screen.getByText('Drop columns here or click')).toBeInTheDocument();
});

test('renders ghost button when empty', () => {
  const ghostButtonText = 'Ghost button text';
  render(
    <DndSelectLabel {...defaultProps} ghostButtonText={ghostButtonText} />,
    { useDndKit: true },
  );
  expect(screen.getByText(ghostButtonText)).toBeInTheDocument();
});

test('renders values', () => {
  const values = 'Values';
  const valuesRenderer = () => <span>{values}</span>;
  render(<DndSelectLabel {...defaultProps} valuesRenderer={valuesRenderer} />, {
    useDndKit: true,
  });
  expect(screen.getByText(values)).toBeInTheDocument();
});

test('Handles ghost button click', () => {
  render(<DndSelectLabel {...defaultProps} />, { useDndKit: true });
  userEvent.click(screen.getByText('Drop columns here or click'));
  expect(defaultProps.onClickGhostButton).toHaveBeenCalled();
});

test('updates dropValidator on changes', () => {
  const { getByTestId, rerender } = render(
    <ExploreContainer>
      <DndSelectLabel {...defaultProps} />
      <MockChildren />
    </ExploreContainer>,
  );
  expect(getByTestId(`mock-result-${defaultProps.name}`)).toHaveTextContent(
    'false',
  );
  rerender(
    <ExploreContainer>
      <DndSelectLabel {...defaultProps} canDrop={() => true} />
      <MockChildren />
    </ExploreContainer>,
  );
  expect(getByTestId(`mock-result-${defaultProps.name}`)).toHaveTextContent(
    'true',
  );
});

// --- resolveCanDrop (folder-aware canDrop logic) ---------------------------
// Extracted from the component's canDrop useMemo so it can be unit-tested
// directly: @dnd-kit's PointerSensor needs real pointer events/layout, which
// jsdom cannot provide, so an actual drag can't be simulated to reach it.

describe('resolveCanDrop', () => {
  const dropValidator = jest.fn();

  beforeEach(() => {
    dropValidator.mockReset();
  });

  test('returns false when there is no active drag', () => {
    expect(resolveCanDrop(undefined, [DndItemType.Column], dropValidator)).toBe(
      false,
    );
    expect(dropValidator).not.toHaveBeenCalled();
  });

  test('returns false when the dragged type is not accepted', () => {
    expect(
      resolveCanDrop(
        { type: DndItemType.Metric, value: { metric_name: 'm' } },
        [DndItemType.Column],
        dropValidator,
      ),
    ).toBe(false);
    expect(dropValidator).not.toHaveBeenCalled();
  });

  test('delegates to dropValidator for a non-folder accepted type', () => {
    dropValidator.mockReturnValue(true);
    const value = { column_name: 'a' };
    expect(
      resolveCanDrop(
        { type: DndItemType.Column, value },
        [DndItemType.Column],
        dropValidator,
      ),
    ).toBe(true);
    expect(dropValidator).toHaveBeenCalledWith({
      type: DndItemType.Column,
      value,
    });
  });

  test('a folder can drop when at least one item is acceptable and valid', () => {
    const okColumn = {
      type: DndItemType.Column,
      value: { column_name: 'a' },
    } as DatasourcePanelDndItem;
    const badTypeItem = {
      type: DndItemType.Metric,
      value: { metric_name: 'm' },
    } as DatasourcePanelDndItem;
    dropValidator.mockImplementation(item => item === okColumn);

    expect(
      resolveCanDrop(
        {
          type: DndItemType.Folder,
          items: [badTypeItem, okColumn],
        },
        [DndItemType.Column, DndItemType.Folder],
        dropValidator,
      ),
    ).toBe(true);
  });

  test('a folder cannot drop when accept excludes Folder itself, even if items match', () => {
    // The general type check runs before the folder branch: a drop zone must
    // explicitly accept DndItemType.Folder for folder drags to be considered
    // at all, regardless of its items.
    dropValidator.mockReturnValue(true);
    expect(
      resolveCanDrop(
        {
          type: DndItemType.Folder,
          items: [{ type: DndItemType.Column, value: { column_name: 'a' } }],
        },
        [DndItemType.Column],
        dropValidator,
      ),
    ).toBe(false);
    expect(dropValidator).not.toHaveBeenCalled();
  });

  test('a folder cannot drop when no item is accepted or valid', () => {
    dropValidator.mockReturnValue(false);
    expect(
      resolveCanDrop(
        {
          type: DndItemType.Folder,
          items: [{ type: DndItemType.Column, value: { column_name: 'a' } }],
        },
        [DndItemType.Column, DndItemType.Folder],
        dropValidator,
      ),
    ).toBe(false);
  });

  test('a folder with no items array cannot drop', () => {
    expect(
      resolveCanDrop(
        { type: DndItemType.Folder },
        [DndItemType.Column, DndItemType.Folder],
        dropValidator,
      ),
    ).toBe(false);
  });
});
