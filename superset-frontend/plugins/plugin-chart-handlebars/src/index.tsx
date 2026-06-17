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

/**
 * Handlebars Chart - Glyph Pattern Implementation
 *
 * Renders data via a user-supplied Handlebars template with optional CSS.
 * Supports both Aggregate and Raw query modes.
 */

import { t } from '@apache-superset/core/translation';
import { styled, useTheme } from '@apache-superset/core/theme';
import {
  buildQueryContext,
  ensureIsArray,
  normalizeOrderBy,
  QueryFormColumn,
  QueryFormData,
  QueryFormMetric,
  QueryMode,
  TimeGranularity,
  TimeseriesDataRecord,
  validateNonEmpty,
} from '@superset-ui/core';
import {
  CodeEditor,
  Constants,
  InfoTooltip,
  SafeMarkdown,
} from '@superset-ui/core/components';
import { extendedDayjs as dayjs } from '@superset-ui/core/utils/dates';
import {
  ControlConfig,
  ControlPanelState,
  ControlPanelsContainerProps,
  ControlSetItem,
  ControlState,
  ControlStateMapping,
  CustomControlConfig,
  Dataset,
  defineSavedMetrics,
  ExtraControlProps,
  getStandardizedControls,
  QueryModeLabel,
  sharedControls,
} from '@superset-ui/chart-controls';
import { defineChart } from '@superset-ui/glyph-core';
import Handlebars from 'handlebars';
import { debounce, isEmpty, isPlainObject } from 'lodash';
import Helpers from 'just-handlebars-helpers';
import HandlebarsGroupBy from 'handlebars-group-by';
import { createRef, ReactNode, useMemo, useState } from 'react';

import thumbnail from './images/thumbnail.png';
import thumbnailDark from './images/thumbnail-dark.png';
import example1 from './images/example1.jpg';
import example1Dark from './images/example1-dark.jpg';
import example2 from './images/example2.jpg';
import example2Dark from './images/example2-dark.jpg';

// ─── Types ───────────────────────────────────────────────────────────────────

export type HandlebarsQueryFormData = QueryFormData & {
  height: number;
  width: number;
  handlebarsTemplate?: string;
  styleTemplate?: string;
  align_pn?: boolean;
  color_pn?: boolean;
  include_time?: boolean;
  include_search?: boolean;
  query_mode?: QueryMode;
  page_length?: string | number | null;
  metrics?: QueryFormMetric[] | null;
  percent_metrics?: QueryFormMetric[] | null;
  timeseries_limit_metric?: QueryFormMetric[] | QueryFormMetric | null;
  groupby?: QueryFormMetric[] | null;
  all_columns?: QueryFormMetric[] | null;
  order_desc?: boolean;
  table_timestamp_format?: string;
  granularitySqla?: string;
  time_grain_sqla?: TimeGranularity;
};

type HandlebarsProps = {
  height: number;
  width: number;
  data: TimeseriesDataRecord[];
  formData: HandlebarsQueryFormData;
};

// ─── Helpers & Utilities ─────────────────────────────────────────────────────

const debounceFunc = debounce(
  (func: (val: string) => void, source: string) => func(source),
  Constants.SLOW_DEBOUNCE,
);

const ControlHeader = ({ children }: { children: ReactNode }) => (
  <div className="ControlHeader">
    <div className="pull-left">{children}</div>
  </div>
);

// ─── Handlebars Template Engine Setup ────────────────────────────────────────

//  usage: {{ dateFormat my_date format="MMMM YYYY" }}
Handlebars.registerHelper('dateFormat', function (context, block) {
  const f = block.hash.format || 'YYYY-MM-DD';
  return dayjs(context).format(f);
});

// usage: {{ stringify myObj }}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
Handlebars.registerHelper('stringify', (obj: any, obj2: any) => {
  if (obj2 === undefined)
    throw new Error('Please call with an object. Example: `stringify myObj`');
  return isPlainObject(obj) ? JSON.stringify(obj) : String(obj);
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
Handlebars.registerHelper(
  'formatNumber',
  function (number: any, locale = 'en-US') {
    if (typeof number !== 'number') return number;
    return number.toLocaleString(locale);
  },
);

// usage: {{parseJson jsonString}}
Handlebars.registerHelper('parseJson', (jsonString: string) => {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    if (error instanceof Error) {
      error.message = `Invalid JSON string: ${error.message}`;
      throw error;
    }
    throw new Error(`Invalid JSON string: ${String(error)}`);
  }
});

Helpers.registerHelpers(Handlebars);
HandlebarsGroupBy.register(Handlebars);

// `just-handlebars-helpers` registers a `formatDate` helper that lazily
// resolves `moment` via `global.moment` / `require('moment/min/moment-with-locales')`.
// The bundled viewer switched to dayjs and never satisfies that lookup, so the
// original helper throws "... is not a function" (see #32960). Re-register a
// dayjs-backed `formatDate` with the same `{{formatDate formatString date [locale]}}`
// signature so existing templates keep rendering.
Handlebars.registerHelper('formatDate', (formatString, date, localeString) => {
  const format = typeof formatString === 'string' ? formatString : '';
  const instance = dayjs(date ?? new Date());
  // Handlebars always passes its options object as the final argument, so a
  // locale is only present when the caller supplied an explicit string.
  // Note: `extendedDayjs` only loads the `en` locale, so passing a non-English
  // locale here quietly falls back to English unless that locale bundle has
  // been imported elsewhere; dayjs's instance `.locale()` is a no-op otherwise.
  return typeof localeString === 'string'
    ? instance.locale(localeString).format(format)
    : instance.format(format);
});

// ─── HandlebarsViewer ────────────────────────────────────────────────────────

const TemplateError = styled.pre`
  white-space: pre-wrap;
`;

function HandlebarsViewer({
  templateSource,
  data,
}: {
  templateSource: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
}) {
  const [renderedTemplate, setRenderedTemplate] = useState('');
  const [error, setError] = useState('');
  const appContainer = document.getElementById('app');
  const { common } = JSON.parse(
    appContainer?.getAttribute('data-bootstrap') || '{}',
  );
  const htmlSanitization = common?.conf?.HTML_SANITIZATION ?? true;
  const htmlSchemaOverrides =
    common?.conf?.HTML_SANITIZATION_SCHEMA_EXTENSIONS || {};

  useMemo(() => {
    try {
      const template = Handlebars.compile(templateSource);
      const result = template(data);
      setRenderedTemplate(result);
      setError('');
    } catch (err) {
      setRenderedTemplate('');
      setError((err as Error).message);
    }
  }, [templateSource, data]);

  if (error) return <TemplateError>{error}</TemplateError>;
  if (renderedTemplate) {
    return (
      <SafeMarkdown
        source={renderedTemplate}
        htmlSanitization={htmlSanitization}
        htmlSchemaOverrides={htmlSchemaOverrides}
      />
    );
  }
  return <p>{t('Loading...')}</p>;
}

// ─── Render Component ────────────────────────────────────────────────────────

const HandlebarsStyles = styled.div<{ height: number; width: number }>`
  padding: ${({ theme }) => theme.sizeUnit * 4}px;
  border-radius: ${({ theme }) => theme.borderRadius}px;
  height: ${({ height }) => height}px;
  width: ${({ width }) => width}px;
  overflow: auto;
`;

function HandlebarsChart(props: HandlebarsProps) {
  const { data, height, width, formData } = props;
  const styleTemplateSource = formData.styleTemplate
    ? `<style>${formData.styleTemplate}</style>`
    : '';
  const templateSource = `${formData.handlebarsTemplate || '{{data}}'}\n${styleTemplateSource} `;
  const rootElem = createRef<HTMLDivElement>();
  return (
    <HandlebarsStyles ref={rootElem} height={height} width={width}>
      <HandlebarsViewer data={{ data }} templateSource={templateSource} />
    </HandlebarsStyles>
  );
}

// ─── Query Mode Utilities ─────────────────────────────────────────────────────

function getQueryMode(controls: ControlStateMapping): QueryMode {
  const mode = controls?.query_mode?.value;
  if (mode === QueryMode.Aggregate || mode === QueryMode.Raw) {
    return mode as QueryMode;
  }
  const rawColumns = controls?.all_columns?.value as
    | QueryFormColumn[]
    | undefined;
  return rawColumns?.length ? QueryMode.Raw : QueryMode.Aggregate;
}

function isQueryMode(mode: QueryMode) {
  return ({ controls }: Pick<ControlPanelsContainerProps, 'controls'>) =>
    getQueryMode(controls) === mode;
}

const isAggMode = isQueryMode(QueryMode.Aggregate);
const isRawMode = isQueryMode(QueryMode.Raw);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function validateAggControlValues(
  controls: ControlStateMapping,
  values: any[],
) {
  const areControlsEmpty = values.every(val => ensureIsArray(val).length === 0);
  return areControlsEmpty && isAggMode({ controls })
    ? [t('Group By, Metrics or Percentage Metrics must have a value')]
    : [];
}

// ─── Controls ─────────────────────────────────────────────────────────────────

const queryModeControlSetItem: ControlSetItem = {
  name: 'query_mode',
  config: {
    type: 'RadioButtonControl',
    label: t('Query mode'),
    default: null,
    options: [
      [QueryMode.Aggregate, QueryModeLabel[QueryMode.Aggregate]],
      [QueryMode.Raw, QueryModeLabel[QueryMode.Raw]],
    ],
    mapStateToProps: ({ controls }) => ({ value: getQueryMode(controls) }),
    rerender: ['all_columns', 'groupby', 'metrics', 'percent_metrics'],
  } as ControlConfig<'RadioButtonControl'>,
};

const groupByControlSetItem: ControlSetItem = {
  name: 'groupby',
  override: {
    visibility: isAggMode,
    resetOnHide: false,
    mapStateToProps: (state: ControlPanelState, controlState: ControlState) => {
      const { controls } = state;
      const originalMapStateToProps = sharedControls?.groupby?.mapStateToProps;
      const newState = originalMapStateToProps?.(state, controlState) ?? {};
      newState.externalValidationErrors = validateAggControlValues(controls, [
        controls.metrics?.value,
        controls.percent_metrics?.value,
        controlState.value,
      ]);
      return newState;
    },
    rerender: ['metrics', 'percent_metrics'],
  },
};

const allColumnsControlSetItem: ControlSetItem = {
  name: 'all_columns',
  config: {
    type: 'DndColumnSelect',
    label: t('Columns'),
    description: t('Columns to display'),
    default: [],
    mapStateToProps({ datasource, controls }, controlState) {
      const newState: ExtraControlProps = {};
      if (datasource) {
        newState.options = datasource.columns || [];
      }
      newState.queryMode = getQueryMode(controls);
      newState.externalValidationErrors =
        isRawMode({ controls }) &&
        ensureIsArray(controlState?.value).length === 0
          ? [t('must have a value')]
          : [];
      return newState;
    },
    visibility: isRawMode,
    resetOnHide: false,
  } as typeof sharedControls.groupby,
};

const metricsControlSetItem: ControlSetItem = {
  name: 'metrics',
  override: {
    validators: [],
    visibility: isAggMode,
    mapStateToProps: (
      { controls, datasource, form_data }: ControlPanelState,
      controlState: ControlState,
    ) => ({
      columns: datasource?.columns || [],
      savedMetrics: defineSavedMetrics(datasource),
      selectedMetrics:
        form_data.metrics || (form_data.metric ? [form_data.metric] : []),
      datasource,
      externalValidationErrors: validateAggControlValues(controls, [
        controls.groupby?.value,
        controls.percent_metrics?.value,
        controlState.value,
      ]),
    }),
    rerender: ['groupby', 'percent_metrics'],
    resetOnHide: false,
  },
};

const percentMetricsControlSetItem: ControlSetItem = {
  name: 'percent_metrics',
  config: {
    type: 'DndMetricSelect',
    label: t('Percentage metrics'),
    description: t(
      'Select one or many metrics to display, that will be displayed in the percentages of total. ' +
        'Percentage metrics will be calculated only from data within the row limit. ' +
        'You can use an aggregation function on a column or write custom SQL to create a percentage metric.',
    ),
    multi: true,
    visibility: isAggMode,
    resetOnHide: false,
    mapStateToProps: ({ datasource, controls }, controlState) => ({
      columns: datasource?.columns || [],
      savedMetrics: defineSavedMetrics(datasource),
      datasource,
      datasourceType: datasource?.type,
      queryMode: getQueryMode(controls),
      externalValidationErrors: validateAggControlValues(controls, [
        controls.groupby?.value,
        controls.metrics?.value,
        controlState?.value,
      ]),
    }),
    rerender: ['groupby', 'metrics'],
    default: [],
    validators: [],
  },
};

const showTotalsControlSetItem: ControlSetItem = {
  name: 'show_totals',
  config: {
    type: 'CheckboxControl',
    label: t('Show summary'),
    default: false,
    description: t(
      'Show total aggregations of selected metrics. Note that row limit does not apply to the result.',
    ),
    visibility: isAggMode,
    resetOnHide: false,
  },
};

const rowLimitControlSetItem: ControlSetItem = {
  name: 'row_limit',
  override: {
    visibility: ({ controls }: ControlPanelsContainerProps) =>
      !controls?.server_pagination?.value,
  },
};

const timeSeriesLimitMetricControlSetItem: ControlSetItem = {
  name: 'timeseries_limit_metric',
  override: {
    visibility: isAggMode,
    resetOnHide: false,
  },
};

const orderByControlSetItem: ControlSetItem = {
  name: 'order_by_cols',
  config: {
    type: 'SelectControl',
    label: t('Ordering'),
    description: t('Order results by selected columns'),
    multi: true,
    default: [],
    mapStateToProps: ({ datasource }) => ({
      choices: datasource?.hasOwnProperty('order_by_choices')
        ? (datasource as Dataset)?.order_by_choices
        : datasource?.columns || [],
    }),
    visibility: isRawMode,
    resetOnHide: false,
  },
};

const orderDescendingControlSetItem: ControlSetItem = {
  name: 'order_desc',
  config: {
    type: 'CheckboxControl',
    label: t('Sort descending'),
    default: true,
    description: t('Whether to sort descending or ascending'),
    visibility: ({ controls }) =>
      !!(
        isAggMode({ controls }) &&
        controls?.timeseries_limit_metric.value &&
        !isEmpty(controls?.timeseries_limit_metric.value)
      ),
    resetOnHide: false,
  },
};

const includeTimeControlSetItem: ControlSetItem = {
  name: 'include_time',
  config: {
    type: 'CheckboxControl',
    label: t('Include time'),
    description: t(
      'Whether to include the time granularity as defined in the time section',
    ),
    default: false,
    visibility: isAggMode,
    resetOnHide: false,
  },
};

// ─── Code Editor Controls ─────────────────────────────────────────────────────

const HandlebarsTemplateControl = (
  props: CustomControlConfig<{ value: string }>,
) => {
  const theme = useTheme();
  const val = String(props?.value || props?.default || '');

  const helperDescriptionsHeader = t(
    'Available Handlebars Helpers in Superset:',
  );
  const helperDescriptions = [
    { key: 'dateFormat', descKey: 'Formats a date using a specified format.' },
    { key: 'stringify', descKey: 'Converts an object to a JSON string.' },
    {
      key: 'formatNumber',
      descKey: 'Formats a number using locale-specific formatting.',
    },
    {
      key: 'parseJson',
      descKey: 'Parses a JSON string into a JavaScript object.',
    },
  ];
  const helpersTooltipContent = `
${helperDescriptionsHeader}

${helperDescriptions
  .map(({ key, descKey }) => `- **${key}**: ${t(descKey)}`)
  .join('\n')}
`;

  return (
    <div>
      <ControlHeader>
        <div>
          {props.label as ReactNode}
          <InfoTooltip
            iconStyle={{ marginLeft: theme.sizeUnit }}
            tooltip={<SafeMarkdown source={helpersTooltipContent} />}
          />
        </div>
      </ControlHeader>
      <CodeEditor
        theme="dark"
        value={val}
        onChange={source => {
          debounceFunc(props.onChange, source || '');
        }}
      />
    </div>
  );
};

const handlebarsTemplateControlSetItem: ControlSetItem = {
  name: 'handlebarsTemplate',
  config: {
    ...sharedControls.entity,
    type: HandlebarsTemplateControl,
    label: t('Handlebars Template'),
    description: t('A handlebars template that is applied to the data'),
    default: `<ul class="data-list">
  {{#each data}}
    <li>{{stringify this}}</li>
  {{/each}}
</ul>`,
    isInt: false,
    renderTrigger: true,
    valueKey: null,
    validators: [validateNonEmpty],
    mapStateToProps: ({ controls }) => ({
      value: controls?.handlebars_template?.value,
    }),
  },
};

const StyleControl = (props: CustomControlConfig<{ value: string }>) => {
  const theme = useTheme();
  const defaultValue = props?.value
    ? undefined
    : `/*
  .data-list {
    background-color: yellow;
  }
*/`;

  return (
    <div>
      <ControlHeader>
        <div>
          {props.label as ReactNode}
          <InfoTooltip
            iconStyle={{ marginLeft: theme.sizeUnit }}
            tooltip={t('You need to configure HTML sanitization to use CSS')}
          />
        </div>
      </ControlHeader>
      <CodeEditor
        theme="dark"
        mode="css"
        value={props.value}
        defaultValue={defaultValue}
        onChange={source => {
          debounceFunc(props.onChange, source || '');
        }}
      />
    </div>
  );
};

const styleControlSetItem: ControlSetItem = {
  name: 'styleTemplate',
  config: {
    ...sharedControls.entity,
    type: StyleControl,
    label: t('CSS Styles'),
    description: t('CSS applied to the chart'),
    isInt: false,
    renderTrigger: true,
    valueKey: null,
    validators: [],
    mapStateToProps: ({ controls }) => ({
      value: controls?.handlebars_template?.value,
    }),
  },
};

// ─── Plugin Definition ────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type HandlebarsExtra = Record<string, any>;

// Standalone exports for testing
export function buildQuery(formData: QueryFormData) {
  return buildQueryContext(formData, baseQueryObject => [
    {
      ...baseQueryObject,
      orderby: normalizeOrderBy(baseQueryObject).orderby,
    },
  ]);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function transformProps(chartProps: any) {
  const { formData, queriesData, width, height } = chartProps;
  const { data } = queriesData[0];
  return { width, height, data, formData };
}

export default defineChart<Record<string, never>, HandlebarsExtra>({
  metadata: {
    name: t('Handlebars'),
    description: t('Write a handlebars template to render the data'),
    thumbnail,
    thumbnailDark,
    exampleGallery: [
      { url: example1, urlDark: example1Dark },
      { url: example2, urlDark: example2Dark },
    ],
  },
  arguments: {},
  buildQuery: (formData: QueryFormData) =>
    buildQueryContext(formData, baseQueryObject => [
      {
        ...baseQueryObject,
        orderby: normalizeOrderBy(baseQueryObject).orderby,
      },
    ]),
  suppressQuerySection: true,
  prependSections: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        [queryModeControlSetItem],
        [groupByControlSetItem],
        [metricsControlSetItem, allColumnsControlSetItem],
        [percentMetricsControlSetItem],
        [timeSeriesLimitMetricControlSetItem, orderByControlSetItem],
        [orderDescendingControlSetItem],
        [rowLimitControlSetItem],
        [includeTimeControlSetItem],
        [showTotalsControlSetItem],
        ['adhoc_filters'],
      ],
    },
    {
      label: t('Options'),
      expanded: true,
      controlSetRows: [
        [handlebarsTemplateControlSetItem],
        [styleControlSetItem],
      ],
    },
  ],
  formDataOverrides: formData => ({
    ...formData,
    groupby: getStandardizedControls().popAllColumns(),
    metrics: getStandardizedControls().popAllMetrics(),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  render: (props: any) => <HandlebarsChart {...props} />,
});
