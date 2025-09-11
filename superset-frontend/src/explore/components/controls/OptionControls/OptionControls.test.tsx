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
import {
  render,
  screen,
  fireEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import {
  OptionControlLabel,
  DragContainer,
  OptionControlContainer,
  Label,
  CaretContainer,
  CloseContainer,
  HeaderContainer,
  LabelsContainer,
  DndLabelsContainer,
  AddControlLabel,
  AddIconButton,
} from 'src/explore/components/controls/OptionControls';

const defaultProps = {
  label: <span>Test label</span>,
  tooltipTitle: 'This is a tooltip title',
  onRemove: jest.fn(),
  onMoveLabel: jest.fn(),
  onDropLabel: jest.fn(),
  type: 'test',
  index: 0,
};

const setup = (overrides?: Record<string, any>) =>
  render(
    <DndProvider backend={HTML5Backend}>
      <OptionControlLabel {...defaultProps} {...overrides} />
    </DndProvider>,
  );

test('should render', async () => {
  const { container } = setup();
  await waitFor(() => expect(container).toBeVisible());
});

test('should display a label', async () => {
  setup();
  expect(await screen.findByText('Test label')).toBeTruthy();
});

test('should display a certification icon if saved metric is certified', async () => {
  const { container } = setup({
    savedMetric: {
      metric_name: 'test_metric',
      is_certified: true,
    },
  });
  await waitFor(() => {
    expect(screen.queryByText('Test label')).toBeFalsy();
    expect(container.querySelector('.metric-option > svg')).toBeInTheDocument();
  });
});

test('triggers onMoveLabel on drop', async () => {
  render(
    <DndProvider backend={HTML5Backend}>
      <OptionControlLabel
        {...defaultProps}
        index={1}
        label={<span>Label 1</span>}
      />
      <OptionControlLabel
        {...defaultProps}
        index={2}
        label={<span>Label 2</span>}
      />
    </DndProvider>,
  );
  await waitFor(() => {
    fireEvent.dragStart(screen.getByText('Label 1'));
    fireEvent.drop(screen.getByText('Label 2'));
    expect(defaultProps.onMoveLabel).toHaveBeenCalled();
  });
});

test('renders DragContainer', () => {
  const { container } = render(<DragContainer />);
  expect(container).toBeInTheDocument();
});

test('renders OptionControlContainer', () => {
  const { container } = render(<OptionControlContainer />);
  expect(container).toBeInTheDocument();
});

test('renders Label', () => {
  const { container } = render(<Label />);
  expect(container).toBeInTheDocument();
});

test('renders CaretContainer', () => {
  const { container } = render(<CaretContainer />);
  expect(container).toBeInTheDocument();
});

test('renders CloseContainer', () => {
  const { container } = render(<CloseContainer />);
  expect(container).toBeInTheDocument();
});

test('renders HeaderContainer', () => {
  const { container } = render(<HeaderContainer />);
  expect(container).toBeInTheDocument();
});

test('renders LabelsContainer', () => {
  const { container } = render(<LabelsContainer />);
  expect(container).toBeInTheDocument();
});

test('renders DndLabelsContainer', () => {
  const { container } = render(<DndLabelsContainer />);
  expect(container).toBeInTheDocument();
});

test('renders AddControlLabel', () => {
  const { container } = render(<AddControlLabel />);
  expect(container).toBeInTheDocument();
});

test('renders AddIconButton', () => {
  const { container } = render(<AddIconButton />);
  expect(container).toBeInTheDocument();
});
