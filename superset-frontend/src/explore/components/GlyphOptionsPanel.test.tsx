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
import { ReactNode } from 'react';
import { render, screen } from 'spec/helpers/testing-library';
import {
  Checkbox,
  Dimension,
  Int,
  Metric,
  Select,
  Temporal,
  Text,
} from '@superset-ui/glyph-core';
import GlyphOptionsPanel from './GlyphOptionsPanel';
import type { ExpandedControlPanelSectionConfig } from './ControlPanelsContainer';

// Capture the props that Control receives so we can assert on them.
const controlPropsCaptured: Array<Record<string, unknown>> = [];
jest.mock('./Control', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    controlPropsCaptured.push(props);
    return (
      <div
        data-test={`glyph-control-${String(props.name)}`}
        data-visible={String(props.isVisible)}
      >
        <span>{String(props.label)}</span>
      </div>
    );
  },
}));

// StashFormDataContainer is just a passthrough wrapper that hides children
// when shouldStash is true. The real one matters in production for clearing
// stashed values; for these tests we just render children.
jest.mock('./StashFormDataContainer', () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => (
    <div data-test="stash">{children}</div>
  ),
}));

function makeSection(controlSetRows: unknown[][]) {
  return {
    label: 'Chart Options',
    controlSetRows,
  } as unknown as ExpandedControlPanelSectionConfig;
}

function defaultProps(
  overrides: Partial<Parameters<typeof GlyphOptionsPanel>[0]> = {},
) {
  return {
    glyphArgs: {},
    chartOptionsSection: makeSection([]),
    formData: { datasource: '1__table', viz_type: 'test' } as Parameters<
      typeof GlyphOptionsPanel
    >[0]['formData'],
    controls: {},
    actions: { setControlValue: jest.fn() } as unknown as Parameters<
      typeof GlyphOptionsPanel
    >[0]['actions'],
    renderControl: jest.fn((item: { name: string }) => (
      <div data-test={`fallback-${item.name}`}>fallback {item.name}</div>
    )) as unknown as Parameters<typeof GlyphOptionsPanel>[0]['renderControl'],
    ...overrides,
  };
}

beforeEach(() => {
  controlPropsCaptured.length = 0;
});

describe('GlyphOptionsPanel - empty/null behavior', () => {
  test('returns null when there are no rows', () => {
    const { container } = render(<GlyphOptionsPanel {...defaultProps()} />);
    expect(container.firstChild).toBeNull();
  });

  test('returns null when all rows are empty arrays', () => {
    const { container } = render(
      <GlyphOptionsPanel
        {...defaultProps({
          chartOptionsSection: makeSection([[], []]),
        })}
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});

describe('GlyphOptionsPanel - glyph-arg rendering', () => {
  test('renders a Checkbox glyph arg natively via Control', () => {
    const ShowLegend = Checkbox.with({ label: 'Show legend', default: true });
    render(
      <GlyphOptionsPanel
        {...defaultProps({
          glyphArgs: { showLegend: ShowLegend },
          chartOptionsSection: makeSection([
            [{ name: 'showLegend', config: { type: 'CheckboxControl' } }],
          ]),
          formData: {
            datasource: '1__table',
            viz_type: 'test',
            showLegend: true,
          } as Parameters<typeof GlyphOptionsPanel>[0]['formData'],
        })}
      />,
    );

    const captured = controlPropsCaptured[0];
    expect(captured).toBeDefined();
    expect(captured.name).toBe('showLegend');
    expect(captured.type).toBe('CheckboxControl');
    expect(captured.value).toBe(true);
    expect(captured.label).toBe('Show legend');
    expect(captured.renderTrigger).toBe(true);
  });

  test('reads value from formData (not Redux controls state)', () => {
    const Title = Text.with({ label: 'Title', default: 'Hi' });
    render(
      <GlyphOptionsPanel
        {...defaultProps({
          glyphArgs: { title: Title },
          chartOptionsSection: makeSection([
            [{ name: 'title', config: { type: 'TextControl' } }],
          ]),
          formData: {
            datasource: '1__table',
            viz_type: 'test',
            title: 'From form data',
          } as Parameters<typeof GlyphOptionsPanel>[0]['formData'],
          // controls has a STALE value - panel should ignore it
          controls: {
            title: {
              value: 'Stale value',
              validationErrors: [],
            } as unknown as Parameters<
              typeof GlyphOptionsPanel
            >[0]['controls'][string],
          },
        })}
      />,
    );
    expect(controlPropsCaptured[0].value).toBe('From form data');
  });

  test('passes validationErrors from Redux controls onto Control', () => {
    const Title = Text.with({ label: 'Title' });
    render(
      <GlyphOptionsPanel
        {...defaultProps({
          glyphArgs: { title: Title },
          chartOptionsSection: makeSection([
            [{ name: 'title', config: { type: 'TextControl' } }],
          ]),
          controls: {
            title: {
              value: undefined,
              validationErrors: ['Required'],
            } as unknown as Parameters<
              typeof GlyphOptionsPanel
            >[0]['controls'][string],
          },
        })}
      />,
    );
    expect(controlPropsCaptured[0].validationErrors).toEqual(['Required']);
  });

  test('renders multiple glyph args in a row', () => {
    const A = Text.with({ label: 'A' });
    const B = Text.with({ label: 'B' });
    render(
      <GlyphOptionsPanel
        {...defaultProps({
          glyphArgs: { a: A, b: B },
          chartOptionsSection: makeSection([
            [
              { name: 'a', config: { type: 'TextControl' } },
              { name: 'b', config: { type: 'TextControl' } },
            ],
          ]),
        })}
      />,
    );
    expect(controlPropsCaptured).toHaveLength(2);
    expect(controlPropsCaptured[0].name).toBe('a');
    expect(controlPropsCaptured[1].name).toBe('b');
  });
});

describe('GlyphOptionsPanel - visibility (visibleWhen)', () => {
  test('isVisible=false when visibleWhen condition fails', () => {
    const ShowLegend = Checkbox.with({ label: 'Show', default: false });
    const Pos = Select.with({
      label: 'Position',
      default: 'top',
      options: [{ label: 'T', value: 'top' }],
    });

    render(
      <GlyphOptionsPanel
        {...defaultProps({
          glyphArgs: {
            showLegend: ShowLegend,
            legendPosition: {
              arg: Pos,
              visibleWhen: { showLegend: true },
            },
          },
          chartOptionsSection: makeSection([
            [{ name: 'showLegend', config: { type: 'CheckboxControl' } }],
            [{ name: 'legendPosition', config: { type: 'SelectControl' } }],
          ]),
          formData: {
            datasource: '1__table',
            viz_type: 'test',
            showLegend: false,
          } as Parameters<typeof GlyphOptionsPanel>[0]['formData'],
        })}
      />,
    );

    const posProps = controlPropsCaptured.find(
      p => p.name === 'legendPosition',
    );
    expect(posProps).toBeDefined();
    expect(posProps!.isVisible).toBe(false);
  });

  test('isVisible=true when visibleWhen condition succeeds', () => {
    const ShowLegend = Checkbox.with({ label: 'Show', default: false });
    const Pos = Select.with({
      label: 'Position',
      default: 'top',
      options: [{ label: 'T', value: 'top' }],
    });

    render(
      <GlyphOptionsPanel
        {...defaultProps({
          glyphArgs: {
            showLegend: ShowLegend,
            legendPosition: {
              arg: Pos,
              visibleWhen: { showLegend: true },
            },
          },
          chartOptionsSection: makeSection([
            [{ name: 'legendPosition', config: { type: 'SelectControl' } }],
          ]),
          formData: {
            datasource: '1__table',
            viz_type: 'test',
            showLegend: true,
          } as Parameters<typeof GlyphOptionsPanel>[0]['formData'],
        })}
      />,
    );

    const posProps = controlPropsCaptured.find(
      p => p.name === 'legendPosition',
    );
    expect(posProps!.isVisible).toBe(true);
  });

  test('no visibleWhen → isVisible is undefined (control renders normally)', () => {
    const T = Text.with({ label: 'Title' });
    render(
      <GlyphOptionsPanel
        {...defaultProps({
          glyphArgs: { title: T },
          chartOptionsSection: makeSection([
            [{ name: 'title', config: { type: 'TextControl' } }],
          ]),
        })}
      />,
    );
    expect(controlPropsCaptured[0].isVisible).toBeUndefined();
  });
});

describe('GlyphOptionsPanel - data-arg skipping (Metric/Dimension/Temporal)', () => {
  test('Metric / Dimension / Temporal args in glyphArgs are NOT rendered here', () => {
    // The Customize-tab section may technically include rows for data args,
    // but the panel filters them out (those belong in the Query tab).
    const Width = Int.with({ label: 'Width', default: 100, min: 0, max: 1000 });
    render(
      <GlyphOptionsPanel
        {...defaultProps({
          glyphArgs: {
            metric: Metric,
            groupby: Dimension,
            t: Temporal,
            width: Width,
          },
          chartOptionsSection: makeSection([
            // Section contains entries for data args (they'd be no-ops)
            // AND one real customize arg (width).
            [{ name: 'metric', config: { type: 'MetricsControl' } }],
            [{ name: 'groupby', config: { type: 'GroupByControl' } }],
            [{ name: 't', config: { type: 'TemporalControl' } }],
            [{ name: 'width', config: { type: 'SliderControl' } }],
          ]),
        })}
      />,
    );

    // Data args should be rendered via the fallback (renderControl) path,
    // NOT through Control with native glyph rendering — because the panel
    // treats them as "non-glyph customize controls".
    const names = controlPropsCaptured.map(p => p.name);
    expect(names).not.toContain('metric');
    expect(names).not.toContain('groupby');
    expect(names).not.toContain('t');
    expect(names).toContain('width');
  });
});

describe('GlyphOptionsPanel - fallback to renderControl', () => {
  test('items NOT in glyphArgs use the renderControl callback', () => {
    const renderControl = jest.fn((item: { name: string }) => (
      <div data-test={`fallback-${item.name}`}>fallback {item.name}</div>
    ));

    render(
      <GlyphOptionsPanel
        {...defaultProps({
          glyphArgs: {}, // empty — everything falls through
          chartOptionsSection: makeSection([
            [{ name: 'legacy_control', config: { type: 'SelectControl' } }],
          ]),
          renderControl: renderControl as unknown as Parameters<
            typeof GlyphOptionsPanel
          >[0]['renderControl'],
        })}
      />,
    );

    expect(renderControl).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'legacy_control' }),
    );
    expect(screen.getByText('fallback legacy_control')).toBeInTheDocument();
  });

  test('mixed row: glyph arg + non-glyph item both render', () => {
    const Show = Checkbox.with({ label: 'Show', default: true });
    const renderControl = jest.fn((item: { name: string }) => (
      <div data-test={`fallback-${item.name}`}>fallback {item.name}</div>
    ));

    render(
      <GlyphOptionsPanel
        {...defaultProps({
          glyphArgs: { showLegend: Show },
          chartOptionsSection: makeSection([
            [
              { name: 'showLegend', config: { type: 'CheckboxControl' } },
              { name: 'color_scheme', config: { type: 'SelectControl' } },
            ],
          ]),
          renderControl: renderControl as unknown as Parameters<
            typeof GlyphOptionsPanel
          >[0]['renderControl'],
        })}
      />,
    );

    // Glyph arg went through Control mock
    expect(
      controlPropsCaptured.find(p => p.name === 'showLegend'),
    ).toBeDefined();
    // Non-glyph item went through renderControl
    expect(renderControl).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'color_scheme' }),
    );
  });
});

describe('GlyphOptionsPanel - section header', () => {
  test('renders the Chart Options label', () => {
    const Show = Checkbox.with({ label: 'Show', default: true });
    render(
      <GlyphOptionsPanel
        {...defaultProps({
          glyphArgs: { show: Show },
          chartOptionsSection: makeSection([
            [{ name: 'show', config: { type: 'CheckboxControl' } }],
          ]),
        })}
      />,
    );
    // Antd Collapse renders the label as its panel header
    expect(screen.getAllByText('Chart Options').length).toBeGreaterThan(0);
  });

  test('uses a custom section label when provided', () => {
    const Show = Checkbox.with({ label: 'Show', default: true });
    const section = {
      label: 'My Custom Section',
      controlSetRows: [[{ name: 'show', config: { type: 'CheckboxControl' } }]],
    } as unknown as ExpandedControlPanelSectionConfig;

    render(
      <GlyphOptionsPanel
        {...defaultProps({
          glyphArgs: { show: Show },
          chartOptionsSection: section,
        })}
      />,
    );
    expect(screen.getAllByText('My Custom Section').length).toBeGreaterThan(0);
  });
});
