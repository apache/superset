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
  act,
  fireEvent,
  render,
  screen,
  selectOption,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import {
  getChartMetadataRegistry,
  ChartMetadata,
  VizType,
} from '@superset-ui/core';
import { logging } from '@apache-superset/core/utils';
import fetchMock from 'fetch-mock';
import setupColors from 'src/setup/setupColors';
import { ANNOTATION_TYPES_METADATA } from './AnnotationTypes';
import AnnotationLayer from './AnnotationLayer';

const defaultProps = {
  value: '',
  vizType: VizType.Table,
  annotationType: ANNOTATION_TYPES_METADATA.FORMULA.value,
  canReadAnnotation: true,
};

const nativeLayerApiRoute = 'glob:*/api/v1/annotation_layer/*';
const chartApiRoute = /\/api\/v1\/chart\/\?q=.+/;
const chartApiWithIdRoute = /\/api\/v1\/chart\/\w+\?q=.+/;

const chartApiWithIdRouteName = 'chart-with-id';
const nativeLayerRouteName = 'native-layer';

const nativeLayerResult = {
  result: [{ name: 'Chart A', id: 'a' }],
};

const withIdResult = {
  result: {
    slice_name: 'Mocked Slice',
    params: JSON.stringify({ groupby: ['country'] }),
    query_context: JSON.stringify({
      form_data: {
        groupby: ['country'],
      },
    }),
    viz_type: VizType.Line,
  },
};

const setViewportWidth = (value: number) =>
  Object.defineProperty(document.documentElement, 'clientWidth', {
    configurable: true,
    value,
  });

// jsdom serves `clientWidth` from the prototype and `jest.restoreAllMocks` leaves
// `defineProperty` alone, so drop the override or every later test inherits it.
const restoreViewportWidth = () =>
  Reflect.deleteProperty(document.documentElement, 'clientWidth');

const rect = (width: number, right: number) =>
  ({
    width,
    right,
    left: right - width,
    top: 0,
    bottom: 0,
    height: 0,
  }) as DOMRect;

const SECTIONS_TEST_ID = 'annotation-layer-sections';

/**
 * Lays the popover out beside a control panel of the given width. `sectionWidth`
 * is what each section wants, which decides whether the row fits on one line.
 */
const mockLayout = (panelWidth: () => number, sectionWidth = 0) =>
  jest
    .spyOn(Element.prototype, 'getBoundingClientRect')
    .mockImplementation(function (this: Element) {
      if (this.id === 'controlSections')
        return rect(panelWidth(), panelWidth());
      if (this.classList.contains('ant-popover')) return rect(802, 1422);
      if (this.getAttribute('data-test') === SECTIONS_TEST_ID)
        return rect(778, 1410);
      if (this.parentElement?.getAttribute('data-test') === SECTIONS_TEST_ID)
        return rect(sectionWidth, sectionWidth);
      return rect(0, 0);
    });

beforeAll(() => {
  const supportedAnnotationTypes = Object.values(ANNOTATION_TYPES_METADATA).map(
    value => value.value,
  );

  fetchMock.get(nativeLayerApiRoute, nativeLayerResult, {
    name: nativeLayerRouteName,
  });

  fetchMock.get(chartApiRoute, {
    result: [{ id: 'a', slice_name: 'Chart A', viz_type: VizType.Table }],
  });

  fetchMock.get(chartApiWithIdRoute, withIdResult, {
    name: chartApiWithIdRouteName,
  });

  setupColors();

  getChartMetadataRegistry().registerValue(
    'table',
    new ChartMetadata({
      name: 'Table',
      thumbnail: '',
      supportedAnnotationTypes,
      canBeAnnotationTypes: ['EVENT'],
    }),
  );
});

// Call history is shared across tests; without this, call-count assertions
// depend on execution order and fail under `jest --randomize`.
beforeEach(() => {
  fetchMock.clearHistory();
});

const waitForRender = (props?: any) =>
  waitFor(() => render(<AnnotationLayer {...defaultProps} {...props} />));

test('renders with default props', async () => {
  await waitForRender();
  expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled();
});

test('renders extra checkboxes when type is time series', async () => {
  await waitForRender();
  expect(
    screen.queryByRole('button', { name: 'Show Markers' }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Hide Line' }),
  ).not.toBeInTheDocument();
  userEvent.click(screen.getAllByText('Formula')[0]);
  userEvent.click(screen.getByText('Time series'));
  expect(
    await screen.findByRole('button', { name: 'Show Markers' }),
  ).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Hide Line' })).toBeInTheDocument();
});

test('enables apply and ok buttons', async () => {
  const { container } = render(<AnnotationLayer {...defaultProps} />);

  await waitFor(() => {
    expect(container).toBeInTheDocument();
  });

  const nameInput = screen.getByRole('textbox', { name: 'Name' });
  const formulaInput = screen.getByRole('textbox', { name: 'Formula' });

  expect(nameInput).toBeInTheDocument();
  expect(formulaInput).toBeInTheDocument();

  userEvent.type(nameInput, 'Name');
  userEvent.type(formulaInput, '2x');

  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'Apply' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeEnabled();
  });
});

test('triggers addAnnotationLayer when apply button is clicked', async () => {
  const addAnnotationLayer = jest.fn();
  await waitForRender({ name: 'Test', value: '2x', addAnnotationLayer });
  userEvent.click(screen.getByRole('button', { name: 'Apply' }));
  expect(addAnnotationLayer).toHaveBeenCalled();
});

test('triggers addAnnotationLayer and close when ok button is clicked', async () => {
  const addAnnotationLayer = jest.fn();
  const close = jest.fn();
  await waitForRender({ name: 'Test', value: '2x', addAnnotationLayer, close });
  userEvent.click(screen.getByRole('button', { name: 'Confirm' }));
  expect(addAnnotationLayer).toHaveBeenCalled();
  expect(close).toHaveBeenCalled();
});

test('triggers close when cancel button is clicked', async () => {
  const close = jest.fn();
  await waitForRender({ close });
  userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(close).toHaveBeenCalled();
});

test('triggers removeAnnotationLayer and close when remove button is clicked', async () => {
  const removeAnnotationLayer = jest.fn();
  const close = jest.fn();
  await waitForRender({
    name: 'Test',
    value: '2x',
    removeAnnotationLayer,
    close,
  });
  userEvent.click(screen.getByRole('button', { name: 'Remove' }));
  expect(removeAnnotationLayer).toHaveBeenCalled();
  expect(close).toHaveBeenCalled();
});

test('fetches Superset annotation layer options', async () => {
  await waitForRender({
    annotationType: ANNOTATION_TYPES_METADATA.EVENT.value,
  });
  userEvent.click(
    screen.getByRole('combobox', { name: 'Annotation source type' }),
  );
  userEvent.click(screen.getByText('Superset annotation'));
  expect(await screen.findByText('Annotation layer')).toBeInTheDocument();
  userEvent.click(
    screen.getByRole('combobox', { name: 'Annotation layer value' }),
  );
  expect(await screen.findByText('Chart A')).toBeInTheDocument();
  expect(fetchMock.callHistory.calls(nativeLayerApiRoute).length).toBe(1);
});

test('fetches chart options', async () => {
  await waitForRender({
    annotationType: ANNOTATION_TYPES_METADATA.EVENT.value,
  });
  userEvent.click(
    screen.getByRole('combobox', { name: 'Annotation source type' }),
  );
  userEvent.click(screen.getByText('Table'));
  expect(await screen.findByText('Chart')).toBeInTheDocument();
  userEvent.click(
    screen.getByRole('combobox', { name: 'Annotation layer value' }),
  );
  expect(await screen.findByText('Chart A')).toBeInTheDocument();
  expect(fetchMock.callHistory.calls(chartApiRoute).length).toBe(1);
});

test('fetches chart on mount if value present', async () => {
  await waitForRender({
    name: 'Test',
    value: 'a',
    annotationType: ANNOTATION_TYPES_METADATA.EVENT.value,
    sourceType: 'Table',
  });
  expect(fetchMock.callHistory.calls(chartApiWithIdRoute).length).toBe(1);
});

test('hides the Superset annotation source without annotation read access', async () => {
  await waitForRender({
    annotationType: ANNOTATION_TYPES_METADATA.EVENT.value,
    canReadAnnotation: false,
  });
  userEvent.click(
    screen.getByRole('combobox', { name: 'Annotation source type' }),
  );
  expect(await screen.findByText('Table')).toBeInTheDocument();
  expect(screen.queryByText('Superset annotation')).not.toBeInTheDocument();
});

test('keeps formula annotations available without annotation read access', async () => {
  await waitForRender({ canReadAnnotation: false });
  expect(screen.getByRole('textbox', { name: 'Formula' })).toBeInTheDocument();
});

test('keeps a saved native layer intact without annotation read access', async () => {
  const addAnnotationLayer = jest.fn();
  await waitForRender({
    name: 'Test',
    value: 1,
    annotationType: ANNOTATION_TYPES_METADATA.EVENT.value,
    sourceType: 'NATIVE',
    canReadAnnotation: false,
    addAnnotationLayer,
  });

  // The saved source stays selected, and the value select is inert with an
  // explanation instead of surfacing a Forbidden error.
  expect(await screen.findByText('Superset annotation')).toBeInTheDocument();
  expect(
    screen.getByRole('combobox', { name: 'Annotation layer value' }),
  ).toBeDisabled();
  expect(
    screen.getByText("You don't have permission to view annotation layers."),
  ).toBeInTheDocument();

  // The saved reference is still valid: re-applying preserves it as is.
  userEvent.click(screen.getByRole('button', { name: 'Apply' }));
  expect(addAnnotationLayer).toHaveBeenCalledWith(
    expect.objectContaining({
      sourceType: 'NATIVE',
      value: 1,
    }),
  );

  // Neither the by-id fetch nor the listing may fire; both are known 403s.
  expect(fetchMock.callHistory.calls(nativeLayerApiRoute).length).toBe(0);
});

test('hydrates the applied native layer name for authorized users', async () => {
  // The show endpoint returns a single object, unlike the list mock.
  fetchMock.modifyRoute(nativeLayerRouteName, {
    response: { result: { id: 1, name: 'My layer' } },
  });

  try {
    await waitForRender({
      name: 'Test',
      value: 1,
      annotationType: ANNOTATION_TYPES_METADATA.EVENT.value,
      sourceType: 'NATIVE',
    });

    expect(await screen.findByText('My layer')).toBeInTheDocument();
    expect(fetchMock.callHistory.calls(nativeLayerApiRoute).length).toBe(1);
  } finally {
    fetchMock.modifyRoute(nativeLayerRouteName, {
      response: nativeLayerResult,
    });
  }
});

test('lets a saved native layer switch to a permitted source', async () => {
  await waitForRender({
    name: 'Test',
    value: 1,
    annotationType: ANNOTATION_TYPES_METADATA.EVENT.value,
    sourceType: 'NATIVE',
    canReadAnnotation: false,
  });

  userEvent.click(
    screen.getByRole('combobox', { name: 'Annotation source type' }),
  );
  userEvent.click(await screen.findByText('Table'));

  // The chart selector takes over, enabled.
  expect(await screen.findByText('Chart')).toBeInTheDocument();
  expect(
    screen.getByRole('combobox', { name: 'Annotation layer value' }),
  ).toBeEnabled();

  // Reopen the source dropdown: it re-renders from the new options, and the
  // native option is gone for good.
  userEvent.click(
    screen.getByRole('combobox', { name: 'Annotation source type' }),
  );
  await waitFor(() =>
    expect(screen.queryByText('Superset annotation')).not.toBeInTheDocument(),
  );
});

test('survives a native annotation layer fetch that fails', async () => {
  const logError = jest.spyOn(logging, 'error').mockImplementation(() => {});
  fetchMock.modifyRoute(nativeLayerRouteName, { response: 403 });

  try {
    await waitForRender({
      name: 'Test',
      value: 1,
      annotationType: ANNOTATION_TYPES_METADATA.EVENT.value,
      sourceType: 'NATIVE',
    });

    expect(screen.getByRole('textbox', { name: 'Name' })).toBeInTheDocument();
    await waitFor(() =>
      expect(logError).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load annotation layer 1'),
        expect.anything(),
      ),
    );
  } finally {
    fetchMock.modifyRoute(nativeLayerRouteName, {
      response: nativeLayerResult,
    });
    logError.mockRestore();
  }
});

test('keeps apply disabled when missing required fields', async () => {
  // With EVENT type and Table source, the component requires selecting a chart
  // and filling in required fields. Without completing these, Apply should be disabled.
  await waitForRender({
    annotationType: ANNOTATION_TYPES_METADATA.EVENT.value,
    sourceType: 'Table',
  });

  // Apply button should be disabled initially since required fields are not filled
  expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled();

  // Select Chart A from the annotation layer value dropdown
  await selectOption('Chart A', 'Annotation layer value');

  // Wait for the chart data to load
  await screen.findByText(/title column/i);

  // Apply should still be disabled because name is not filled
  expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled();
});

test('renders slice configuration for a chart that has no generated query context', async () => {
  // A chart never opened in Explore has `query_context: null`, so the columns
  // have to come from its saved `params`.
  fetchMock.modifyRoute(chartApiWithIdRouteName, {
    response: {
      result: {
        slice_name: 'Mocked Slice',
        params: JSON.stringify({ groupby: ['country'] }),
        query_context: null,
        viz_type: VizType.Line,
      },
    },
  });

  try {
    await waitForRender({
      annotationType: ANNOTATION_TYPES_METADATA.EVENT.value,
      sourceType: 'Table',
    });

    await selectOption('Chart A', 'Annotation layer value');

    expect(await screen.findByText(/title column/i)).toBeInTheDocument();

    // The column options come from the saved `params` form data.
    userEvent.click(
      screen.getByRole('combobox', { name: 'Annotation layer time column' }),
    );
    expect(await screen.findByTitle('country')).toBeInTheDocument();
  } finally {
    fetchMock.modifyRoute(chartApiWithIdRouteName, { response: withIdResult });
  }
});

test('renders slice configuration on mount for a chart with no generated query context', async () => {
  fetchMock.modifyRoute(chartApiWithIdRouteName, {
    response: {
      result: {
        slice_name: 'Mocked Slice',
        params: JSON.stringify({ groupby: ['country'] }),
        query_context: null,
        viz_type: VizType.Table,
      },
    },
  });

  try {
    await waitForRender({
      name: 'Test',
      value: 'a',
      annotationType: ANNOTATION_TYPES_METADATA.EVENT.value,
      sourceType: 'Table',
    });

    expect(await screen.findByText(/title column/i)).toBeInTheDocument();
  } finally {
    fetchMock.modifyRoute(chartApiWithIdRouteName, { response: withIdResult });
  }
});

test('survives a chart endpoint that fails', async () => {
  // The bug this replaces was an unhandled rejection that left the popover in a
  // half-populated state, so a failure has to stay contained and reported.
  const logError = jest.spyOn(logging, 'error').mockImplementation(() => {});
  fetchMock.modifyRoute(chartApiWithIdRouteName, { response: 500 });

  try {
    await waitForRender({
      name: 'Test',
      value: 'a',
      annotationType: ANNOTATION_TYPES_METADATA.EVENT.value,
      sourceType: 'Table',
    });

    expect(screen.getByRole('textbox', { name: 'Name' })).toBeInTheDocument();
    await waitFor(() =>
      expect(logError).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load annotation source chart a'),
        expect.anything(),
      ),
    );
    expect(screen.queryByText(/title column/i)).not.toBeInTheDocument();
  } finally {
    fetchMock.modifyRoute(chartApiWithIdRouteName, { response: withIdResult });
    logError.mockRestore();
  }
});

test('reports a chart that carries no form data at all', async () => {
  // Neither column is guaranteed: `query_context` is backfilled lazily and
  // `params` can be empty, and then there is nothing to build the fields from.
  const logWarn = jest.spyOn(logging, 'warn').mockImplementation(() => {});
  fetchMock.modifyRoute(chartApiWithIdRouteName, {
    response: {
      // `VizType.Table` is the registered one, so the chart clears the
      // annotation-type check and reaches the form data.
      result: {
        ...withIdResult.result,
        params: null,
        query_context: null,
        viz_type: VizType.Table,
      },
    },
  });

  try {
    await waitForRender({
      name: 'Test',
      value: 'a',
      annotationType: ANNOTATION_TYPES_METADATA.EVENT.value,
      sourceType: 'Table',
    });

    await waitFor(() =>
      expect(logWarn).toHaveBeenCalledWith(
        expect.stringContaining('has no usable form data'),
      ),
    );
    expect(screen.queryByText(/title column/i)).not.toBeInTheDocument();
  } finally {
    fetchMock.modifyRoute(chartApiWithIdRouteName, { response: withIdResult });
    logWarn.mockRestore();
  }
});

test('bounds the section row to the viewport so the footer stays reachable', async () => {
  // Adding the slice configuration section must not push the display
  // configuration or the Apply/OK buttons past the viewport.
  await waitForRender({
    annotationType: ANNOTATION_TYPES_METADATA.EVENT.value,
    sourceType: 'Table',
  });

  const sections = screen.getByTestId('annotation-layer-sections');
  expect(sections).toHaveStyle('flex-wrap: wrap');
  expect(sections).toHaveStyle('max-width: calc(100vw - 64px)');
  // The footer is a sibling of the sections, never inside the row.
  expect(sections).not.toContainElement(
    screen.getByRole('button', { name: 'Apply' }),
  );
});

test('caps the section row to the room left beside the control panel', async () => {
  // The cap is measured from the panel's edge, not the popover's own: the
  // popover moves as the row narrows, so measuring it feeds each cap into the
  // next one and converges on a column too narrow to lay the sections out in.
  setViewportWidth(1160);
  // Two sections at 238 need 508 to stay on one line, which is what fits beside
  // the panel here.
  mockLayout(() => 620, 238);

  try {
    await waitFor(() =>
      render(
        <>
          <div id="controlSections" />
          <div className="ant-popover">
            <AnnotationLayer
              {...defaultProps}
              annotationType={ANNOTATION_TYPES_METADATA.EVENT.value}
              sourceType="Table"
            />
          </div>
        </>,
      ),
    );

    // 1160 viewport - 620 panel - 24 popover padding - 8 inset
    expect(screen.getByTestId('annotation-layer-sections')).toHaveStyle(
      'max-width: 508px',
    );

    // A cap measured once would go stale across a resize. Here the room beside
    // the panel drops to 348px, too little to keep both sections on one line, so
    // the viewport becomes the bound: 1000 - 24 padding - 2 x 8 inset.
    setViewportWidth(1000);
    fireEvent(window, new Event('resize'));

    await waitFor(() =>
      expect(screen.getByTestId('annotation-layer-sections')).toHaveStyle(
        'max-width: 960px',
      ),
    );
  } finally {
    restoreViewportWidth();
    jest.restoreAllMocks();
  }
});

test('caps the section row again when the control panel is dragged wider', async () => {
  // Dragging the panel's resizer moves the edge the cap comes from without
  // resizing the window, and the jsdom ResizeObserver never calls back, so stand
  // in for it here and check that the panel is what gets watched.
  const observed: Element[] = [];
  let notifyResize = () => {};
  const NativeResizeObserver = window.ResizeObserver;
  window.ResizeObserver = class {
    constructor(callback: ResizeObserverCallback) {
      notifyResize = () => callback([], this as unknown as ResizeObserver);
    }

    observe(target: Element) {
      observed.push(target);
    }

    unobserve() {}

    disconnect() {}
  };

  setViewportWidth(1160);
  let panelWidth = 620;
  mockLayout(() => panelWidth, 238);

  try {
    render(
      <>
        <div id="controlSections" />
        <div className="ant-popover">
          <AnnotationLayer
            {...defaultProps}
            annotationType={ANNOTATION_TYPES_METADATA.EVENT.value}
            sourceType="Table"
          />
        </div>
      </>,
    );

    await waitFor(() =>
      expect(screen.getByTestId('annotation-layer-sections')).toHaveStyle(
        'max-width: 508px',
      ),
    );
    expect(observed).toContain(document.getElementById('controlSections'));

    // 228px is left beside the panel, too little to keep both sections on one
    // line, so the bound falls back to the viewport: 1160 - 24 - 2 x 8 inset.
    panelWidth = 900;
    act(() => notifyResize());

    await waitFor(() =>
      expect(screen.getByTestId('annotation-layer-sections')).toHaveStyle(
        'max-width: 1120px',
      ),
    );
  } finally {
    window.ResizeObserver = NativeResizeObserver;
    restoreViewportWidth();
    jest.restoreAllMocks();
  }
});

test('leaves the slice configuration section on one line rather than wrapping', async () => {
  // Wrapping the third section roughly doubles the popover's height - measured at
  // 620px of sections against 256px unwrapped - and a popover taller than the
  // viewport cannot be shifted back in, so the footer ends up below the fold.
  // Room beside the panel is preferred only while the row still fits on one line.
  setViewportWidth(1160);
  mockLayout(() => 620, 238);
  fetchMock.modifyRoute(chartApiWithIdRouteName, {
    response: {
      result: { ...withIdResult.result, viz_type: VizType.Table },
    },
  });

  try {
    render(
      <>
        <div id="controlSections" />
        <div className="ant-popover">
          <AnnotationLayer
            {...defaultProps}
            name="Test"
            value="a"
            annotationType={ANNOTATION_TYPES_METADATA.EVENT.value}
            sourceType="Table"
          />
        </div>
      </>,
    );

    // Three sections need 778px for one line and only 508px is free beside the
    // panel, so the viewport bounds it instead: 1160 - 24 padding - 2 x 8 inset.
    expect(await screen.findByText(/title column/i)).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByTestId('annotation-layer-sections')).toHaveStyle(
        'max-width: 1120px',
      ),
    );
  } finally {
    fetchMock.modifyRoute(chartApiWithIdRouteName, { response: withIdResult });
    restoreViewportWidth();
    jest.restoreAllMocks();
  }
});

test('Disable apply button if formula is incorrect', async () => {
  await waitForRender({ name: 'test' });

  const formulaInput = screen.getByRole('textbox', { name: 'Formula' });
  const applyButton = screen.getByRole('button', { name: 'Apply' });
  const okButton = screen.getByRole('button', { name: 'Confirm' });

  userEvent.type(formulaInput, 'x+1');
  expect(formulaInput).toHaveValue('x+1');
  await waitFor(() => {
    expect(okButton).toBeEnabled();
    expect(applyButton).toBeEnabled();
  });

  userEvent.clear(formulaInput);
  await waitFor(() => {
    expect(formulaInput).toHaveValue('');
  });
  userEvent.type(formulaInput, 'y = x*2+1');
  expect(formulaInput).toHaveValue('y = x*2+1');
  await waitFor(() => {
    expect(okButton).toBeEnabled();
    expect(applyButton).toBeEnabled();
  });

  userEvent.clear(formulaInput);
  await waitFor(() => {
    expect(formulaInput).toHaveValue('');
  });
  userEvent.type(formulaInput, 'y+1');
  expect(formulaInput).toHaveValue('y+1');
  await waitFor(() => {
    expect(okButton).toBeDisabled();
    expect(applyButton).toBeDisabled();
  });

  userEvent.clear(formulaInput);
  await waitFor(() => {
    expect(formulaInput).toHaveValue('');
  });
  userEvent.type(formulaInput, 'x+');
  expect(formulaInput).toHaveValue('x+');
  await waitFor(() => {
    expect(okButton).toBeDisabled();
    expect(applyButton).toBeDisabled();
  });

  userEvent.clear(formulaInput);
  await waitFor(() => {
    expect(formulaInput).toHaveValue('');
  });
  userEvent.type(formulaInput, 'y = z+1');
  expect(formulaInput).toHaveValue('y = z+1');
  await waitFor(() => {
    expect(okButton).toBeDisabled();
    expect(applyButton).toBeDisabled();
  });
});
