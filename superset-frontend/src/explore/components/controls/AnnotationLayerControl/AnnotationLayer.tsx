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
import React, { PureComponent } from 'react';
import rison from 'rison';
import {
  Button,
  AsyncSelect,
  EmptyState,
  ColorPicker,
} from '@superset-ui/core/components';
import {
  SupersetClient,
  getCategoricalSchemeRegistry,
  getChartMetadataRegistry,
  validateNonEmpty,
  isValidExpression,
  getColumnLabel,
  VizType,
  type QueryFormColumn,
} from '@superset-ui/core';
import { t } from '@apache-superset/core';
import {
  styled,
  withTheme,
  type SupersetTheme,
} from '@apache-superset/core/ui';
import SelectControl from 'src/explore/components/controls/SelectControl';
import TextControl from 'src/explore/components/controls/TextControl';
import CheckboxControl from 'src/explore/components/controls/CheckboxControl';
import PopoverSection from '@superset-ui/core/components/PopoverSection';
import ControlHeader from 'src/explore/components/ControlHeader';
import {
  ANNOTATION_SOURCE_TYPES,
  ANNOTATION_TYPES,
  ANNOTATION_TYPES_METADATA,
  DEFAULT_ANNOTATION_TYPE,
  requiresQuery,
  ANNOTATION_SOURCE_TYPES_METADATA,
} from './AnnotationTypes';

interface SelectOption {
  value: string | number;
  label: string;
  viz_type?: string;
  [key: string]: unknown;
}

interface SliceData {
  data: {
    groupby?: string[];
    all_columns?: string[];
    include_time?: boolean;
    [key: string]: unknown;
  };
}

interface AnnotationOverrides {
  time_range?: string | null;
  time_grain_sqla?: string | null;
  granularity?: string | null;
  time_shift?: string;
  [key: string]: unknown;
}

interface AnnotationLayerProps {
  name?: string;
  annotationType?: string;
  sourceType?: string;
  color?: string;
  opacity?: string;
  style?: string;
  width?: number;
  showMarkers?: boolean;
  hideLine?: boolean;
  value?: string | number | SelectOption;
  overrides?: AnnotationOverrides;
  show?: boolean;
  showLabel?: boolean;
  titleColumn?: string;
  descriptionColumns?: string[];
  timeColumn?: string;
  intervalEndColumn?: string;
  vizType?: string;
  error?: string;
  colorScheme?: string;
  theme: SupersetTheme;
  addAnnotationLayer?: (annotation: Record<string, unknown>) => void;
  removeAnnotationLayer?: () => void;
  close?: () => void;
}

interface AnnotationLayerState {
  name: string;
  annotationType: string;
  sourceType: string | null;
  value: string | number | SelectOption | null;
  overrides: AnnotationOverrides;
  show: boolean;
  showLabel: boolean;
  titleColumn: string;
  descriptionColumns: string[];
  timeColumn: string;
  intervalEndColumn: string;
  color: string;
  opacity: string;
  style: string;
  width: number;
  showMarkers: boolean;
  hideLine: boolean;
  isNew: boolean;
  slice: SliceData | null;
}

const AUTOMATIC_COLOR = '';

const NotFoundContentWrapper = styled.div`
  && > div:first-of-type {
    padding-left: 0;
    padding-right: 0;
  }
`;

const NotFoundContent = () => (
  <NotFoundContentWrapper>
    <EmptyState
      title={t('No annotation layers')}
      size="small"
      description={
        <span>
          {t('Add an annotation layer')}{' '}
          <a
            href="/annotationlayer/list"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t('here')}
          </a>
          .
        </span>
      }
      image="empty.svg"
    />
  </NotFoundContentWrapper>
);

class AnnotationLayer extends PureComponent<
  AnnotationLayerProps,
  AnnotationLayerState
> {
  static defaultProps = {
    name: '',
    annotationType: DEFAULT_ANNOTATION_TYPE,
    sourceType: '',
    color: AUTOMATIC_COLOR,
    opacity: '',
    style: 'solid',
    width: 1,
    showMarkers: false,
    hideLine: false,
    overrides: {},
    colorScheme: 'd3Category10',
    show: true,
    showLabel: false,
    titleColumn: '',
    descriptionColumns: [],
    timeColumn: '',
    intervalEndColumn: '',
    addAnnotationLayer: () => {},
    removeAnnotationLayer: () => {},
    close: () => {},
  };

  constructor(props: AnnotationLayerProps) {
    super(props);
    const {
      name,
      annotationType,
      sourceType,
      color,
      opacity,
      style,
      width,
      showMarkers,
      hideLine,
      value,
      overrides,
      show,
      showLabel,
      titleColumn,
      descriptionColumns,
      timeColumn,
      intervalEndColumn,
      vizType,
    } = props;

    // Only allow override whole time_range
    const processedOverrides: AnnotationOverrides = overrides
      ? { ...overrides }
      : {};
    if ('since' in processedOverrides || 'until' in processedOverrides) {
      processedOverrides.time_range = null;
      delete processedOverrides.since;
      delete processedOverrides.until;
    }

    // Check if annotationType is supported by this chart
    const metadata = vizType ? getChartMetadataRegistry().get(vizType) : null;
    const supportedAnnotationTypes = metadata?.supportedAnnotationTypes || [];
    const resolvedAnnotationType = annotationType || DEFAULT_ANNOTATION_TYPE;
    const validAnnotationType = supportedAnnotationTypes.includes(
      resolvedAnnotationType,
    )
      ? resolvedAnnotationType
      : supportedAnnotationTypes[0];

    this.state = {
      // base
      name: name || '',
      annotationType: validAnnotationType || DEFAULT_ANNOTATION_TYPE,
      sourceType: sourceType || null,
      value: value || null,
      overrides: processedOverrides,
      show: show ?? true,
      showLabel: showLabel ?? false,
      // slice
      titleColumn: titleColumn || '',
      descriptionColumns: descriptionColumns || [],
      timeColumn: timeColumn || '',
      intervalEndColumn: intervalEndColumn || '',
      // display
      color: color || AUTOMATIC_COLOR,
      opacity: opacity || '',
      style: style || 'solid',
      width: width ?? 1,
      showMarkers: showMarkers ?? false,
      hideLine: hideLine ?? false,
      // refData
      isNew: !name,
      slice: null,
    };
    this.submitAnnotation = this.submitAnnotation.bind(this);
    this.deleteAnnotation = this.deleteAnnotation.bind(this);
    this.applyAnnotation = this.applyAnnotation.bind(this);
    this.isValidForm = this.isValidForm.bind(this);
    // Handlers
    this.handleAnnotationType = this.handleAnnotationType.bind(this);
    this.handleAnnotationSourceType =
      this.handleAnnotationSourceType.bind(this);
    this.handleSelectValue = this.handleSelectValue.bind(this);
    this.handleTextValue = this.handleTextValue.bind(this);
    // Fetch related functions
    this.fetchOptions = this.fetchOptions.bind(this);
    this.fetchCharts = this.fetchCharts.bind(this);
    this.fetchNativeAnnotations = this.fetchNativeAnnotations.bind(this);
    this.fetchAppliedAnnotation = this.fetchAppliedAnnotation.bind(this);
    this.fetchSliceData = this.fetchSliceData.bind(this);
    this.shouldFetchSliceData = this.shouldFetchSliceData.bind(this);
    this.fetchAppliedChart = this.fetchAppliedChart.bind(this);
    this.fetchAppliedNativeAnnotation =
      this.fetchAppliedNativeAnnotation.bind(this);
    this.shouldFetchAppliedAnnotation =
      this.shouldFetchAppliedAnnotation.bind(this);
  }

  componentDidMount() {
    if (this.shouldFetchAppliedAnnotation()) {
      const { value } = this.state;
      /* The value prop is the id of the chart/native. This function will set
      value in state to an object with the id as value.value to be used by
      AsyncSelect */
      if (value !== null && typeof value !== 'object') {
        this.fetchAppliedAnnotation(value);
      }
    }
  }

  componentDidUpdate(
    _prevProps: AnnotationLayerProps,
    prevState: AnnotationLayerState,
  ): void {
    if (this.shouldFetchSliceData(prevState)) {
      const { value } = this.state;
      if (value && typeof value === 'object' && 'value' in value) {
        this.fetchSliceData(value.value);
      }
    }
  }

  getSupportedSourceTypes(annotationType: string): SelectOption[] {
    // Get vis types that can be source.
    const sources = getChartMetadataRegistry()
      .entries()
      .filter(({ value: chartMetadata }) =>
        chartMetadata?.canBeAnnotationType(annotationType),
      )
      .map(({ key, value: chartMetadata }) => ({
        value: key === VizType.Line ? 'line' : key,
        label: chartMetadata?.name || key,
      }));
    // Prepend native source if applicable
    const annotationMeta =
      ANNOTATION_TYPES_METADATA[
        annotationType as keyof typeof ANNOTATION_TYPES_METADATA
      ];
    if (annotationMeta && 'supportNativeSource' in annotationMeta) {
      sources.unshift(ANNOTATION_SOURCE_TYPES_METADATA.NATIVE);
    }
    return sources;
  }

  shouldFetchAppliedAnnotation(): boolean {
    const { value, sourceType } = this.state;
    return !!value && requiresQuery(sourceType ?? undefined);
  }

  shouldFetchSliceData(prevState: AnnotationLayerState): boolean {
    const { value, sourceType } = this.state;
    const isChart =
      sourceType !== ANNOTATION_SOURCE_TYPES.NATIVE &&
      requiresQuery(sourceType ?? undefined);
    const valueIsNew = value && prevState.value !== value;
    return !!valueIsNew && isChart;
  }

  isValidFormulaAnnotation(
    expression: string | number | SelectOption | null,
    annotationType: string,
  ): boolean {
    if (annotationType === ANNOTATION_TYPES.FORMULA) {
      return isValidExpression(expression as string);
    }
    return true;
  }

  isValidForm(): boolean {
    const {
      name,
      annotationType,
      sourceType,
      value,
      timeColumn,
      intervalEndColumn,
    } = this.state;
    const errors = [
      validateNonEmpty(name),
      validateNonEmpty(annotationType),
      validateNonEmpty(value),
    ];
    if (sourceType !== ANNOTATION_SOURCE_TYPES.NATIVE) {
      if (annotationType === ANNOTATION_TYPES.EVENT) {
        errors.push(validateNonEmpty(timeColumn));
      }
      if (annotationType === ANNOTATION_TYPES.INTERVAL) {
        errors.push(validateNonEmpty(timeColumn));
        errors.push(validateNonEmpty(intervalEndColumn));
      }
    }
    if (!this.isValidFormulaAnnotation(value, annotationType)) {
      errors.push(t('Invalid formula expression'));
    }
    return !errors.filter(x => x).length;
  }

  handleAnnotationType(annotationType: string): void {
    this.setState({
      annotationType,
      sourceType: null,
      value: null,
      slice: null,
    });
  }

  handleAnnotationSourceType(sourceType: string): void {
    const { sourceType: prevSourceType } = this.state;

    if (prevSourceType !== sourceType) {
      this.setState({
        sourceType,
        value: null,
        slice: null,
      });
    }
  }

  handleSelectValue(selectedValueObject: SelectOption): void {
    this.setState({
      value: selectedValueObject,
      descriptionColumns: [],
      intervalEndColumn: '',
      timeColumn: '',
      titleColumn: '',
      overrides: { time_range: null },
    });
  }

  handleTextValue(inputValue: string): void {
    this.setState({
      value: inputValue,
    });
  }

  fetchNativeAnnotations = async (
    search: string,
    page: number,
    pageSize: number,
  ): Promise<{ data: SelectOption[]; totalCount: number }> => {
    const queryParams = rison.encode({
      filters: [
        {
          col: 'name',
          opr: 'ct',
          value: search,
        },
      ],
      columns: ['id', 'name'],
      page,
      page_size: pageSize,
    });

    const { json } = await SupersetClient.get({
      endpoint: `/api/v1/annotation_layer/?q=${queryParams}`,
    });

    const { result, count } = json;

    const layersArray = result.map((layer: { id: number; name: string }) => ({
      value: layer.id,
      label: layer.name,
    }));

    return {
      data: layersArray,
      totalCount: count,
    };
  };

  fetchCharts = async (
    search: string,
    page: number,
    pageSize: number,
  ): Promise<{ data: SelectOption[]; totalCount: number }> => {
    const { annotationType } = this.state;

    const queryParams = rison.encode({
      filters: [
        { col: 'slice_name', opr: 'chart_all_text', value: search },
        {
          col: 'id',
          opr: 'chart_owned_created_favored_by_me',
          value: true,
        },
      ],
      columns: ['id', 'slice_name', 'viz_type'],
      order_column: 'slice_name',
      order_direction: 'asc',
      page,
      page_size: pageSize,
    });
    const { json } = await SupersetClient.get({
      endpoint: `/api/v1/chart/?q=${queryParams}`,
    });

    const { result, count } = json;
    const registry = getChartMetadataRegistry();

    const chartsArray = result
      .filter((chart: { id: number; slice_name: string; viz_type: string }) => {
        const metadata = registry.get(chart.viz_type);
        return metadata && metadata.canBeAnnotationType(annotationType);
      })
      .map((chart: { id: number; slice_name: string; viz_type: string }) => ({
        value: chart.id,
        label: chart.slice_name,
        viz_type: chart.viz_type,
      }));

    return {
      data: chartsArray,
      totalCount: count,
    };
  };

  fetchOptions = (
    search: string,
    page: number,
    pageSize: number,
  ): Promise<{ data: SelectOption[]; totalCount: number }> => {
    const { sourceType } = this.state;

    if (sourceType === ANNOTATION_SOURCE_TYPES.NATIVE) {
      return this.fetchNativeAnnotations(search, page, pageSize);
    }
    return this.fetchCharts(search, page, pageSize);
  };

  fetchSliceData = (id: string | number): void => {
    const queryParams = rison.encode({
      columns: ['query_context'],
    });
    SupersetClient.get({
      endpoint: `/api/v1/chart/${id}?q=${queryParams}`,
    }).then(({ json }) => {
      const { result } = json;
      const queryContext = result.query_context;
      const formData = JSON.parse(queryContext).form_data;
      const dataObject = {
        data: {
          ...formData,
          groupby: formData.groupby?.map((column: QueryFormColumn) =>
            getColumnLabel(column),
          ),
        },
      };
      this.setState({
        slice: dataObject,
      });
    });
  };

  fetchAppliedChart(id: string | number): void {
    const { annotationType } = this.state;
    const registry = getChartMetadataRegistry();
    const queryParams = rison.encode({
      columns: ['slice_name', 'query_context', 'viz_type'],
    });
    SupersetClient.get({
      endpoint: `/api/v1/chart/${id}?q=${queryParams}`,
    }).then(({ json }) => {
      const { result } = json;
      const sliceName = result.slice_name;
      const queryContext = result.query_context;
      const vizType = result.viz_type;
      const formData = JSON.parse(queryContext).form_data;
      const metadata = registry.get(vizType);
      const canBeAnnotationType =
        metadata && metadata.canBeAnnotationType(annotationType);
      if (canBeAnnotationType) {
        this.setState({
          value: {
            value: id,
            label: sliceName,
          },
          slice: {
            data: {
              ...formData,
              groupby: formData.groupby?.map((column: QueryFormColumn) =>
                getColumnLabel(column),
              ),
            },
          },
        });
      }
    });
  }

  fetchAppliedNativeAnnotation(id: string | number): void {
    SupersetClient.get({
      endpoint: `/api/v1/annotation_layer/${id}`,
    }).then(({ json }) => {
      const { result } = json;
      const layer = result;
      this.setState({
        value: {
          value: layer.id,
          label: layer.name,
        },
      });
    });
  }

  fetchAppliedAnnotation(id: string | number): void {
    const { sourceType } = this.state;

    if (sourceType === ANNOTATION_SOURCE_TYPES.NATIVE) {
      return this.fetchAppliedNativeAnnotation(id);
    }
    return this.fetchAppliedChart(id);
  }

  deleteAnnotation(): void {
    this.props.removeAnnotationLayer?.();
    this.props.close?.();
  }

  applyAnnotation(): void {
    const { value, sourceType } = this.state;
    if (this.isValidForm()) {
      const annotationFields = [
        'name',
        'annotationType',
        'sourceType',
        'color',
        'opacity',
        'style',
        'width',
        'showMarkers',
        'hideLine',
        'overrides',
        'show',
        'showLabel',
        'titleColumn',
        'descriptionColumns',
        'timeColumn',
        'intervalEndColumn',
      ];
      const newAnnotation: Record<string, unknown> = {};
      annotationFields.forEach(field => {
        const stateValue = this.state[field as keyof AnnotationLayerState];
        if (stateValue !== null) {
          newAnnotation[field] = stateValue;
        }
      });

      // Prepare newAnnotation.value for use in runAnnotationQuery()
      const applicableValue =
        requiresQuery(sourceType ?? undefined) &&
        value &&
        typeof value === 'object'
          ? (value as SelectOption).value
          : value;
      newAnnotation.value = applicableValue;

      if (newAnnotation.color === AUTOMATIC_COLOR) {
        newAnnotation.color = null;
      }

      this.props.addAnnotationLayer?.(newAnnotation);
      this.setState({ isNew: false });
    }
  }

  submitAnnotation(): void {
    this.applyAnnotation();
    this.props.close?.();
  }

  renderChartHeader(
    label: string,
    description: string,
    value: string | number | SelectOption | null,
  ): React.ReactNode {
    return (
      <ControlHeader
        hovered
        label={label}
        description={description}
        validationErrors={!value ? ['Mandatory'] : []}
      />
    );
  }

  renderValueConfiguration(): React.ReactNode {
    const { annotationType, sourceType, value } = this.state;
    let label = '';
    let description = '';
    if (requiresQuery(sourceType ?? undefined)) {
      if (sourceType === ANNOTATION_SOURCE_TYPES.NATIVE) {
        label = t('Annotation layer');
        description = t('Select the Annotation Layer you would like to use.');
      } else {
        label = t('Chart');
        description = t(
          `Use another existing chart as a source for annotations and overlays.
          Your chart must be one of these visualization types: [%s]`,
          this.getSupportedSourceTypes(annotationType)
            .map(x => x.label)
            .join(', '),
        );
      }
    } else if (annotationType === ANNOTATION_TYPES.FORMULA) {
      label = t('Formula');
      description = t(`Expects a formula with depending time parameter 'x'
        in milliseconds since epoch. mathjs is used to evaluate the formulas.
        Example: '2x+5'`);
    }
    if (requiresQuery(sourceType ?? undefined)) {
      return (
        <AsyncSelect
          /* key to force re-render on sourceType change */
          key={sourceType}
          ariaLabel={t('Annotation layer value')}
          name="annotation-layer-value"
          header={this.renderChartHeader(label, description, value)}
          options={this.fetchOptions}
          value={value || null}
          onChange={this.handleSelectValue}
          notFoundContent={<NotFoundContent />}
        />
      );
    }
    if (annotationType === ANNOTATION_TYPES.FORMULA) {
      // Extract primitive value for TextControl (formula is always a string)
      const textValue = typeof value === 'object' ? null : value;
      return (
        <TextControl
          name="annotation-layer-value"
          hovered
          showHeader
          description={description}
          label={label}
          placeholder=""
          value={textValue}
          onChange={this.handleTextValue}
          validationErrors={
            !this.isValidFormulaAnnotation(value, annotationType)
              ? [t('Bad formula.')]
              : []
          }
        />
      );
    }
    return '';
  }

  renderSliceConfiguration(): React.ReactNode {
    const {
      annotationType,
      sourceType,
      value,
      slice,
      overrides,
      titleColumn,
      timeColumn,
      intervalEndColumn,
      descriptionColumns,
    } = this.state;

    if (!slice || !value) {
      return '';
    }

    if (sourceType !== ANNOTATION_SOURCE_TYPES.NATIVE && slice) {
      const columns = (slice.data.groupby || [])
        .concat(slice.data.all_columns || [])
        .map(x => ({ value: x, label: x }));
      const timeColumnOptions = slice.data.include_time
        ? [{ value: '__timestamp', label: '__timestamp' }].concat(columns)
        : columns;
      return (
        <div style={{ marginRight: '2rem' }}>
          <PopoverSection
            isSelected
            title={t('Annotation Slice Configuration')}
            info={t(`This section allows you to configure how to use the slice
              to generate annotations.`)}
          >
            {(annotationType === ANNOTATION_TYPES.EVENT ||
              annotationType === ANNOTATION_TYPES.INTERVAL) && (
              <SelectControl
                ariaLabel={t('Annotation layer time column')}
                hovered
                name="annotation-layer-time-column"
                label={
                  annotationType === ANNOTATION_TYPES.INTERVAL
                    ? t('Interval start column')
                    : t('Event time column')
                }
                description={t(
                  'This column must contain date/time information.',
                )}
                validationErrors={!timeColumn ? ['Mandatory'] : []}
                clearable={false}
                options={timeColumnOptions}
                value={timeColumn}
                onChange={(
                  v: string | number | (string | number)[] | null | undefined,
                ) => this.setState({ timeColumn: String(v ?? '') })}
              />
            )}
            {annotationType === ANNOTATION_TYPES.INTERVAL && (
              <SelectControl
                ariaLabel={t('Annotation layer interval end')}
                hovered
                name="annotation-layer-intervalEnd"
                label={t('Interval End column')}
                description={t(
                  'This column must contain date/time information.',
                )}
                validationErrors={!intervalEndColumn ? ['Mandatory'] : []}
                options={columns}
                value={intervalEndColumn}
                onChange={(
                  value:
                    | string
                    | number
                    | (string | number)[]
                    | null
                    | undefined,
                ) => this.setState({ intervalEndColumn: String(value ?? '') })}
              />
            )}
            <SelectControl
              ariaLabel={t('Annotation layer title column')}
              hovered
              name="annotation-layer-title"
              label={t('Title Column')}
              description={t('Pick a title for you annotation.')}
              options={[{ value: '', label: t('None') }].concat(columns)}
              value={titleColumn}
              onChange={(
                value: string | number | (string | number)[] | null | undefined,
              ) => this.setState({ titleColumn: String(value ?? '') })}
            />
            {annotationType !== ANNOTATION_TYPES.TIME_SERIES && (
              <SelectControl
                ariaLabel={t('Annotation layer description columns')}
                hovered
                name="annotation-layer-title"
                label={t('Description Columns')}
                description={t(
                  "Pick one or more columns that should be shown in the annotation. If you don't select a column all of them will be shown.",
                )}
                multi
                options={columns}
                value={descriptionColumns}
                onChange={(
                  value:
                    | string
                    | number
                    | (string | number)[]
                    | null
                    | undefined,
                ) => {
                  const cols = Array.isArray(value) ? value.map(String) : [];
                  this.setState({ descriptionColumns: cols });
                }}
              />
            )}
            <div style={{ marginTop: '1rem' }}>
              <CheckboxControl
                hovered
                name="annotation-override-time_range"
                label={t('Override time range')}
                description={t(`This controls whether the "time_range" field from the current
                  view should be passed down to the chart containing the annotation data.`)}
                value={'time_range' in overrides}
                onChange={v => {
                  delete overrides.time_range;
                  if (v) {
                    this.setState({
                      overrides: { ...overrides, time_range: null },
                    });
                  } else {
                    this.setState({ overrides: { ...overrides } });
                  }
                }}
              />
              <CheckboxControl
                hovered
                name="annotation-override-timegrain"
                label={t('Override time grain')}
                description={t(`This controls whether the time grain field from the current
                  view should be passed down to the chart containing the annotation data.`)}
                value={'time_grain_sqla' in overrides}
                onChange={v => {
                  delete overrides.time_grain_sqla;
                  delete overrides.granularity;
                  if (v) {
                    this.setState({
                      overrides: {
                        ...overrides,
                        time_grain_sqla: null,
                        granularity: null,
                      },
                    });
                  } else {
                    this.setState({ overrides: { ...overrides } });
                  }
                }}
              />
              <TextControl
                hovered
                name="annotation-layer-timeshift"
                label={t('Time Shift')}
                description={t(`Time delta in natural language
                  (example:  24 hours, 7 days, 56 weeks, 365 days)`)}
                placeholder=""
                value={overrides.time_shift}
                onChange={v =>
                  this.setState({ overrides: { ...overrides, time_shift: v } })
                }
              />
            </div>
          </PopoverSection>
        </div>
      );
    }
    return '';
  }

  renderDisplayConfiguration(): React.ReactNode {
    const {
      color,
      opacity,
      style,
      width,
      showMarkers,
      hideLine,
      annotationType,
    } = this.state;
    const colorScheme =
      getCategoricalSchemeRegistry()
        .get(this.props.colorScheme)
        ?.colors.concat() ?? [];
    if (
      color &&
      color !== AUTOMATIC_COLOR &&
      !colorScheme.find(x => x.toLowerCase() === color.toLowerCase())
    ) {
      colorScheme.push(color);
    }
    return (
      <PopoverSection
        isSelected
        title={t('Display configuration')}
        info={t('Configure your how you overlay is displayed here.')}
      >
        <SelectControl
          ariaLabel={t('Annotation layer stroke')}
          name="annotation-layer-stroke"
          label={t('Style')}
          // see '../../../visualizations/nvd3_vis.css'
          options={[
            { value: 'solid', label: t('Solid') },
            { value: 'dashed', label: t('Dashed') },
            { value: 'longDashed', label: t('Long dashed') },
            { value: 'dotted', label: t('Dotted') },
          ]}
          value={style}
          clearable={false}
          onChange={(
            v: string | number | (string | number)[] | null | undefined,
          ) => this.setState({ style: String(v ?? 'solid') })}
        />
        <SelectControl
          ariaLabel={t('Annotation layer opacity')}
          name="annotation-layer-opacity"
          label={t('Opacity')}
          // see '../../../visualizations/nvd3_vis.css'
          options={[
            { value: '', label: t('Solid') },
            { value: 'opacityLow', label: '0.2' },
            { value: 'opacityMedium', label: '0.5' },
            { value: 'opacityHigh', label: '0.8' },
          ]}
          value={opacity}
          onChange={(
            value: string | number | (string | number)[] | null | undefined,
          ) => this.setState({ opacity: String(value ?? '') })}
        />
        <div
          style={{
            marginTop: this.props.theme.sizeUnit * 2,
            marginBottom: this.props.theme.sizeUnit * 2,
          }}
        >
          <CheckboxControl
            name="annotation-layer-automatic-color"
            label={t('Use automatic color')}
            value={color === AUTOMATIC_COLOR}
            onChange={useAutomatic => {
              if (useAutomatic) {
                this.setState({ color: AUTOMATIC_COLOR });
              } else {
                // Set to first theme color or dark color as fallback
                this.setState({
                  color: colorScheme[0] || this.props.theme.colorTextBase,
                });
              }
            }}
          />
          {color !== AUTOMATIC_COLOR && (
            <div style={{ marginTop: this.props.theme.sizeUnit * 2 }}>
              <ControlHeader label={t('Color')} />
              <ColorPicker
                value={color}
                presets={[{ label: 'Theme colors', colors: colorScheme }]}
                onChangeComplete={colorValue =>
                  this.setState({ color: colorValue.toHexString() })
                }
                showText
              />
            </div>
          )}
        </div>
        <TextControl
          name="annotation-layer-stroke-width"
          label={t('Line width')}
          isInt
          value={width}
          onChange={v => this.setState({ width: v })}
        />
        {annotationType === ANNOTATION_TYPES.TIME_SERIES && (
          <CheckboxControl
            hovered
            name="annotation-layer-show-markers"
            label={t('Show Markers')}
            description={t('Shows or hides markers for the time series')}
            value={showMarkers}
            onChange={v => this.setState({ showMarkers: v })}
          />
        )}
        {annotationType === ANNOTATION_TYPES.TIME_SERIES && (
          <CheckboxControl
            hovered
            name="annotation-layer-hide-line"
            label={t('Hide Line')}
            description={t('Hides the Line for the time series')}
            value={hideLine}
            onChange={v => this.setState({ hideLine: v })}
          />
        )}
      </PopoverSection>
    );
  }

  render(): React.ReactNode {
    const { isNew, name, annotationType, sourceType, show, showLabel } =
      this.state;
    const isValid = this.isValidForm();
    const metadata = this.props.vizType
      ? getChartMetadataRegistry().get(this.props.vizType)
      : null;
    const supportedAnnotationTypes = metadata
      ? metadata.supportedAnnotationTypes.map(
          type =>
            ANNOTATION_TYPES_METADATA[
              type as keyof typeof ANNOTATION_TYPES_METADATA
            ],
        )
      : [];
    const supportedSourceTypes = this.getSupportedSourceTypes(annotationType);

    return (
      <>
        {this.props.error && (
          <span style={{ color: this.props.theme.colorError }}>
            ERROR: {this.props.error}
          </span>
        )}
        <div style={{ display: 'flex', flexDirection: 'row' }}>
          <div style={{ marginRight: '2rem' }}>
            <PopoverSection
              isSelected
              title={t('Layer configuration')}
              info={t('Configure the basics of your Annotation Layer.')}
            >
              <TextControl
                name="annotation-layer-name"
                label={t('Name')}
                placeholder=""
                value={name}
                onChange={v => this.setState({ name: v })}
                validationErrors={!name ? [t('Mandatory')] : []}
              />
              <CheckboxControl
                name="annotation-layer-hide"
                label={t('Hide layer')}
                value={!show}
                onChange={v => this.setState({ show: !v })}
              />
              <CheckboxControl
                name="annotation-label-show"
                label={t('Show label')}
                value={showLabel}
                hovered
                description={t('Whether to always show the annotation label')}
                onChange={v => this.setState({ showLabel: v })}
              />
              <SelectControl
                ariaLabel={t('Annotation layer type')}
                hovered
                description={t('Choose the annotation layer type')}
                label={t('Annotation layer type')}
                name="annotation-layer-type"
                clearable={false}
                options={supportedAnnotationTypes}
                value={annotationType}
                onChange={this.handleAnnotationType}
              />
              {supportedSourceTypes.length > 0 && (
                <SelectControl
                  ariaLabel={t('Annotation source type')}
                  hovered
                  description={t('Choose the source of your annotations')}
                  label={t('Annotation source')}
                  name="annotation-source-type"
                  options={supportedSourceTypes}
                  notFoundContent={<NotFoundContent />}
                  value={sourceType}
                  onChange={this.handleAnnotationSourceType}
                  validationErrors={!sourceType ? [t('Mandatory')] : []}
                />
              )}
              {this.renderValueConfiguration()}
            </PopoverSection>
          </div>
          {this.renderSliceConfiguration()}
          {this.renderDisplayConfiguration()}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          {isNew ? (
            <Button
              buttonSize="small"
              buttonStyle="secondary"
              onClick={() => this.props.close?.()}
            >
              {t('Cancel')}
            </Button>
          ) : (
            <Button
              buttonSize="small"
              buttonStyle="secondary"
              onClick={this.deleteAnnotation}
            >
              {t('Remove')}
            </Button>
          )}
          <div>
            <Button
              buttonSize="small"
              disabled={!isValid}
              onClick={this.applyAnnotation}
            >
              {t('Apply')}
            </Button>

            <Button
              buttonSize="small"
              buttonStyle="primary"
              disabled={!isValid}
              onClick={this.submitAnnotation}
            >
              {t('OK')}
            </Button>
          </div>
        </div>
      </>
    );
  }
}

export default withTheme(AnnotationLayer);
