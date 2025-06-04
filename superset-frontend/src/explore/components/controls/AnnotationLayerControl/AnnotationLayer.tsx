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
import { PureComponent } from 'react';
import rison from 'rison';
import PropTypes from 'prop-types';
// @ts-expect-error TS(7016): Could not find a declaration file for module 'reac... Remove this comment to see the full error message
import { CompactPicker } from 'react-color';
import { Button, AsyncSelect, EmptyState } from '@superset-ui/core/components';
import {
  t,
  SupersetClient,
  getCategoricalSchemeRegistry,
  getChartMetadataRegistry,
  validateNonEmpty,
  isValidExpression,
  styled,
  getColumnLabel,
  withTheme,
} from '@superset-ui/core';
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

const AUTOMATIC_COLOR = '';

const propTypes = {
  name: PropTypes.string,
  annotationType: PropTypes.string,
  sourceType: PropTypes.string,
  color: PropTypes.string,
  opacity: PropTypes.string,
  style: PropTypes.string,
  width: PropTypes.number,
  showMarkers: PropTypes.bool,
  hideLine: PropTypes.bool,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  overrides: PropTypes.object,
  show: PropTypes.bool,
  showLabel: PropTypes.bool,
  titleColumn: PropTypes.string,
  descriptionColumns: PropTypes.arrayOf(PropTypes.string),
  timeColumn: PropTypes.string,
  intervalEndColumn: PropTypes.string,
  vizType: PropTypes.string,

  error: PropTypes.string,
  colorScheme: PropTypes.string,

  addAnnotationLayer: PropTypes.func,
  removeAnnotationLayer: PropTypes.func,
  close: PropTypes.func,
};

const defaultProps = {
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

const NotFoundContentWrapper = styled.div`
  && > div:first-child {
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

class AnnotationLayer extends PureComponent {
  constructor(props: $TSFixMe) {
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
    if ('since' in overrides || 'until' in overrides) {
      overrides.time_range = null;
      delete overrides.since;
      delete overrides.until;
    }

    // Check if annotationType is supported by this chart
    const metadata = getChartMetadataRegistry().get(vizType);
    const supportedAnnotationTypes = metadata?.supportedAnnotationTypes || [];
    const validAnnotationType = supportedAnnotationTypes.includes(
      annotationType,
    )
      ? annotationType
      : supportedAnnotationTypes[0];

    this.state = {
      // base
      name,
      annotationType: validAnnotationType,
      sourceType,
      value,
      overrides,
      show,
      showLabel,
      // slice
      titleColumn,
      descriptionColumns,
      timeColumn,
      intervalEndColumn,
      // display
      color: color || AUTOMATIC_COLOR,
      opacity,
      style,
      width,
      showMarkers,
      hideLine,
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
      // @ts-expect-error TS(2339): Property 'value' does not exist on type 'Readonly<... Remove this comment to see the full error message
      const { value } = this.state;
      /* The value prop is the id of the chart/native. This function will set
      value in state to an object with the id as value.value to be used by
      AsyncSelect */
      this.fetchAppliedAnnotation(value);
    }
  }

  componentDidUpdate(prevProps: $TSFixMe, prevState: $TSFixMe) {
    if (this.shouldFetchSliceData(prevState)) {
      // @ts-expect-error TS(2339): Property 'value' does not exist on type 'Readonly<... Remove this comment to see the full error message
      const { value } = this.state;
      this.fetchSliceData(value.value);
    }
  }

  getSupportedSourceTypes(annotationType: $TSFixMe) {
    // Get vis types that can be source.
    const sources = getChartMetadataRegistry()
      .entries()
      .filter(({ value: chartMetadata }) =>
        // @ts-expect-error TS(2532): Object is possibly 'undefined'.
        chartMetadata.canBeAnnotationType(annotationType),
      )
      .map(({ key, value: chartMetadata }) => ({
        value: key,
        // @ts-expect-error TS(2532): Object is possibly 'undefined'.
        label: chartMetadata.name,
      }));
    // Prepend native source if applicable
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    if (ANNOTATION_TYPES_METADATA[annotationType]?.supportNativeSource) {
      sources.unshift(ANNOTATION_SOURCE_TYPES_METADATA.NATIVE);
    }
    return sources;
  }

  shouldFetchAppliedAnnotation() {
    // @ts-expect-error TS(2339): Property 'value' does not exist on type 'Readonly<... Remove this comment to see the full error message
    const { value, sourceType } = this.state;
    return value && requiresQuery(sourceType);
  }

  shouldFetchSliceData(prevState: $TSFixMe) {
    // @ts-expect-error TS(2339): Property 'value' does not exist on type 'Readonly<... Remove this comment to see the full error message
    const { value, sourceType } = this.state;
    const isChart =
      // @ts-expect-error TS(2339): Property 'NATIVE' does not exist on type '{}'.
      sourceType !== ANNOTATION_SOURCE_TYPES.NATIVE &&
      requiresQuery(sourceType);
    const valueIsNew = value && prevState.value !== value;
    return valueIsNew && isChart;
  }

  isValidFormulaAnnotation(expression: $TSFixMe, annotationType: $TSFixMe) {
    // @ts-expect-error TS(2339): Property 'FORMULA' does not exist on type '{}'.
    if (annotationType === ANNOTATION_TYPES.FORMULA) {
      return isValidExpression(expression);
    }
    return true;
  }

  isValidForm() {
    const {
      // @ts-expect-error TS(2339): Property 'name' does not exist on type 'Readonly<{... Remove this comment to see the full error message
      name,
      // @ts-expect-error TS(2339): Property 'annotationType' does not exist on type '... Remove this comment to see the full error message
      annotationType,
      // @ts-expect-error TS(2339): Property 'sourceType' does not exist on type 'Read... Remove this comment to see the full error message
      sourceType,
      // @ts-expect-error TS(2339): Property 'value' does not exist on type 'Readonly<... Remove this comment to see the full error message
      value,
      // @ts-expect-error TS(2339): Property 'timeColumn' does not exist on type 'Read... Remove this comment to see the full error message
      timeColumn,
      // @ts-expect-error TS(2339): Property 'intervalEndColumn' does not exist on typ... Remove this comment to see the full error message
      intervalEndColumn,
    } = this.state;
    const errors = [
      validateNonEmpty(name),
      validateNonEmpty(annotationType),
      validateNonEmpty(value),
    ];
    // @ts-expect-error TS(2339): Property 'NATIVE' does not exist on type '{}'.
    if (sourceType !== ANNOTATION_SOURCE_TYPES.NATIVE) {
      // @ts-expect-error TS(2339): Property 'EVENT' does not exist on type '{}'.
      if (annotationType === ANNOTATION_TYPES.EVENT) {
        errors.push(validateNonEmpty(timeColumn));
      }
      // @ts-expect-error TS(2339): Property 'INTERVAL' does not exist on type '{}'.
      if (annotationType === ANNOTATION_TYPES.INTERVAL) {
        errors.push(validateNonEmpty(timeColumn));
        errors.push(validateNonEmpty(intervalEndColumn));
      }
    }
    errors.push(!this.isValidFormulaAnnotation(value, annotationType));
    return !errors.filter(x => x).length;
  }

  handleAnnotationType(annotationType: $TSFixMe) {
    this.setState({
      annotationType,
      sourceType: null,
      value: null,
      slice: null,
    });
  }

  handleAnnotationSourceType(sourceType: $TSFixMe) {
    // @ts-expect-error TS(2339): Property 'sourceType' does not exist on type 'Read... Remove this comment to see the full error message
    const { sourceType: prevSourceType } = this.state;

    if (prevSourceType !== sourceType) {
      this.setState({
        sourceType,
        value: null,
        slice: null,
      });
    }
  }

  handleSelectValue(selectedValueObject: $TSFixMe) {
    this.setState({
      value: selectedValueObject,
      descriptionColumns: [],
      intervalEndColumn: null,
      timeColumn: null,
      titleColumn: null,
      overrides: { time_range: null },
    });
  }

  handleTextValue(inputValue: $TSFixMe) {
    this.setState({
      value: inputValue,
    });
  }

  fetchNativeAnnotations = async (
    search: $TSFixMe,
    page: $TSFixMe,
    pageSize: $TSFixMe,
  ) => {
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

    const layersArray = result.map((layer: $TSFixMe) => ({
      value: layer.id,
      label: layer.name,
    }));

    return {
      data: layersArray,
      totalCount: count,
    };
  };

  fetchCharts = async (
    search: $TSFixMe,
    page: $TSFixMe,
    pageSize: $TSFixMe,
  ) => {
    // @ts-expect-error TS(2339): Property 'annotationType' does not exist on type '... Remove this comment to see the full error message
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
      .filter((chart: $TSFixMe) => {
        const metadata = registry.get(chart.viz_type);
        return metadata && metadata.canBeAnnotationType(annotationType);
      })
      .map((chart: $TSFixMe) => ({
        value: chart.id,
        label: chart.slice_name,
        viz_type: chart.viz_type,
      }));

    return {
      data: chartsArray,
      totalCount: count,
    };
  };

  fetchOptions = (search: $TSFixMe, page: $TSFixMe, pageSize: $TSFixMe) => {
    // @ts-expect-error TS(2339): Property 'sourceType' does not exist on type 'Read... Remove this comment to see the full error message
    const { sourceType } = this.state;

    // @ts-expect-error TS(2339): Property 'NATIVE' does not exist on type '{}'.
    if (sourceType === ANNOTATION_SOURCE_TYPES.NATIVE) {
      return this.fetchNativeAnnotations(search, page, pageSize);
    }
    return this.fetchCharts(search, page, pageSize);
  };

  fetchSliceData = (id: $TSFixMe) => {
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
          groupby: formData.groupby?.map((column: $TSFixMe) =>
            getColumnLabel(column),
          ),
        },
      };
      this.setState({
        slice: dataObject,
      });
    });
  };

  fetchAppliedChart(id: $TSFixMe) {
    // @ts-expect-error TS(2339): Property 'annotationType' does not exist on type '... Remove this comment to see the full error message
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
              groupby: formData.groupby?.map((column: $TSFixMe) =>
                getColumnLabel(column),
              ),
            },
          },
        });
      }
    });
  }

  fetchAppliedNativeAnnotation(id: $TSFixMe) {
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

  fetchAppliedAnnotation(id: $TSFixMe) {
    // @ts-expect-error TS(2339): Property 'sourceType' does not exist on type 'Read... Remove this comment to see the full error message
    const { sourceType } = this.state;

    // @ts-expect-error TS(2339): Property 'NATIVE' does not exist on type '{}'.
    if (sourceType === ANNOTATION_SOURCE_TYPES.NATIVE) {
      return this.fetchAppliedNativeAnnotation(id);
    }
    return this.fetchAppliedChart(id);
  }

  deleteAnnotation() {
    // @ts-expect-error TS(2339): Property 'removeAnnotationLayer' does not exist on... Remove this comment to see the full error message
    this.props.removeAnnotationLayer();
    // @ts-expect-error TS(2339): Property 'close' does not exist on type 'Readonly<... Remove this comment to see the full error message
    this.props.close();
  }

  applyAnnotation() {
    // @ts-expect-error TS(2339): Property 'value' does not exist on type 'Readonly<... Remove this comment to see the full error message
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
      const newAnnotation = {};
      annotationFields.forEach(field => {
        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        if (this.state[field] !== null) {
          // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
          newAnnotation[field] = this.state[field];
        }
      });

      // Prepare newAnnotation.value for use in runAnnotationQuery()
      const applicableValue = requiresQuery(sourceType) ? value.value : value;
      // @ts-expect-error TS(2339): Property 'value' does not exist on type '{}'.
      newAnnotation.value = applicableValue;

      // @ts-expect-error TS(2339): Property 'color' does not exist on type '{}'.
      if (newAnnotation.color === AUTOMATIC_COLOR) {
        // @ts-expect-error TS(2339): Property 'color' does not exist on type '{}'.
        newAnnotation.color = null;
      }

      // @ts-expect-error TS(2339): Property 'addAnnotationLayer' does not exist on ty... Remove this comment to see the full error message
      this.props.addAnnotationLayer(newAnnotation);
      this.setState({ isNew: false });
    }
  }

  submitAnnotation() {
    this.applyAnnotation();
    // @ts-expect-error TS(2339): Property 'close' does not exist on type 'Readonly<... Remove this comment to see the full error message
    this.props.close();
  }

  renderChartHeader(label: $TSFixMe, description: $TSFixMe, value: $TSFixMe) {
    return (
      <ControlHeader
        hovered
        label={label}
        description={description}
        validationErrors={!value ? ['Mandatory'] : []}
      />
    );
  }

  renderValueConfiguration() {
    // @ts-expect-error TS(2339): Property 'annotationType' does not exist on type '... Remove this comment to see the full error message
    const { annotationType, sourceType, value } = this.state;
    let label = '';
    let description = '';
    if (requiresQuery(sourceType)) {
      // @ts-expect-error TS(2339): Property 'NATIVE' does not exist on type '{}'.
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
    // @ts-expect-error TS(2339): Property 'FORMULA' does not exist on type '{}'.
    } else if (annotationType === ANNOTATION_TYPES.FORMULA) {
      label = t('Formula');
      description = t(`Expects a formula with depending time parameter 'x'
        in milliseconds since epoch. mathjs is used to evaluate the formulas.
        Example: '2x+5'`);
    }
    if (requiresQuery(sourceType)) {
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
    // @ts-expect-error TS(2339): Property 'FORMULA' does not exist on type '{}'.
    if (annotationType === ANNOTATION_TYPES.FORMULA) {
      return (
        <TextControl
          // @ts-expect-error TS(2322): Type '{ name: string; hovered: true; showHeader: t... Remove this comment to see the full error message
          name="annotation-layer-value"
          hovered
          showHeader
          description={description}
          label={label}
          placeholder=""
          value={value}
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

  renderSliceConfiguration() {
    const {
      // @ts-expect-error TS(2339): Property 'annotationType' does not exist on type '... Remove this comment to see the full error message
      annotationType,
      // @ts-expect-error TS(2339): Property 'sourceType' does not exist on type 'Read... Remove this comment to see the full error message
      sourceType,
      // @ts-expect-error TS(2339): Property 'value' does not exist on type 'Readonly<... Remove this comment to see the full error message
      value,
      // @ts-expect-error TS(2339): Property 'slice' does not exist on type 'Readonly<... Remove this comment to see the full error message
      slice,
      // @ts-expect-error TS(2339): Property 'overrides' does not exist on type 'Reado... Remove this comment to see the full error message
      overrides,
      // @ts-expect-error TS(2339): Property 'titleColumn' does not exist on type 'Rea... Remove this comment to see the full error message
      titleColumn,
      // @ts-expect-error TS(2339): Property 'timeColumn' does not exist on type 'Read... Remove this comment to see the full error message
      timeColumn,
      // @ts-expect-error TS(2339): Property 'intervalEndColumn' does not exist on typ... Remove this comment to see the full error message
      intervalEndColumn,
      // @ts-expect-error TS(2339): Property 'descriptionColumns' does not exist on ty... Remove this comment to see the full error message
      descriptionColumns,
    } = this.state;

    if (!slice || !value) {
      return '';
    }

    // @ts-expect-error TS(2339): Property 'NATIVE' does not exist on type '{}'.
    if (sourceType !== ANNOTATION_SOURCE_TYPES.NATIVE && slice) {
      const columns = (slice.data.groupby || [])
        .concat(slice.data.all_columns || [])
        .map((x: $TSFixMe) => ({
          value: x,
          label: x,
        }));
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
            // @ts-expect-error TS(2339): Property 'EVENT' does not exist on type '{}'.
            {(annotationType === ANNOTATION_TYPES.EVENT ||
              // @ts-expect-error TS(2339): Property 'INTERVAL' does not exist on type '{}'.
              annotationType === ANNOTATION_TYPES.INTERVAL) && (
              <SelectControl
                // @ts-expect-error TS(2322): Type '{ ariaLabel: string; hovered: true; name: st... Remove this comment to see the full error message
                ariaLabel={t('Annotation layer time column')}
                hovered
                name="annotation-layer-time-column"
                label={
                  // @ts-expect-error TS(2339): Property 'INTERVAL' does not exist on type '{}'.
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
                onChange={(v: $TSFixMe) => this.setState({ timeColumn: v })}
              />
            )}
            // @ts-expect-error TS(2339): Property 'INTERVAL' does not exist on type '{}'.
            {annotationType === ANNOTATION_TYPES.INTERVAL && (
              <SelectControl
                // @ts-expect-error TS(2322): Type '{ ariaLabel: string; hovered: true; name: st... Remove this comment to see the full error message
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
                onChange={(value: $TSFixMe) =>
                  this.setState({ intervalEndColumn: value })
                }
              />
            )}
            <SelectControl
              // @ts-expect-error TS(2322): Type '{ ariaLabel: string; hovered: true; name: st... Remove this comment to see the full error message
              ariaLabel={t('Annotation layer title column')}
              hovered
              name="annotation-layer-title"
              label={t('Title Column')}
              description={t('Pick a title for you annotation.')}
              options={[{ value: '', label: t('None') }].concat(columns)}
              value={titleColumn}
              onChange={(value: $TSFixMe) =>
                this.setState({ titleColumn: value })
              }
            />
            // @ts-expect-error TS(2339): Property 'TIME_SERIES' does not exist on type '{}'... Remove this comment to see the full error message
            {annotationType !== ANNOTATION_TYPES.TIME_SERIES && (
              <SelectControl
                // @ts-expect-error TS(2322): Type '{ ariaLabel: string; hovered: true; name: st... Remove this comment to see the full error message
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
                onChange={(value: $TSFixMe) =>
                  this.setState({ descriptionColumns: value })
                }
              />
            )}
            <div style={{ marginTop: '1rem' }}>
              <CheckboxControl
                // @ts-expect-error TS(2769): No overload matches this call.
                hovered
                name="annotation-override-time_range"
                label={t('Override time range')}
                description={t(`This controls whether the "time_range" field from the current
                  view should be passed down to the chart containing the annotation data.`)}
                value={'time_range' in overrides}
                onChange={(v: $TSFixMe) => {
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
                // @ts-expect-error TS(2769): No overload matches this call.
                hovered
                name="annotation-override-timegrain"
                label={t('Override time grain')}
                description={t(`This controls whether the time grain field from the current
                  view should be passed down to the chart containing the annotation data.`)}
                value={'time_grain_sqla' in overrides}
                onChange={(v: $TSFixMe) => {
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
                // @ts-expect-error TS(2322): Type '{ hovered: true; name: string; label: string... Remove this comment to see the full error message
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

  renderDisplayConfiguration() {
    const {
      // @ts-expect-error TS(2339): Property 'color' does not exist on type 'Readonly<... Remove this comment to see the full error message
      color,
      // @ts-expect-error TS(2339): Property 'opacity' does not exist on type 'Readonl... Remove this comment to see the full error message
      opacity,
      // @ts-expect-error TS(2339): Property 'style' does not exist on type 'Readonly<... Remove this comment to see the full error message
      style,
      // @ts-expect-error TS(2339): Property 'width' does not exist on type 'Readonly<... Remove this comment to see the full error message
      width,
      // @ts-expect-error TS(2339): Property 'showMarkers' does not exist on type 'Rea... Remove this comment to see the full error message
      showMarkers,
      // @ts-expect-error TS(2339): Property 'hideLine' does not exist on type 'Readon... Remove this comment to see the full error message
      hideLine,
      // @ts-expect-error TS(2339): Property 'annotationType' does not exist on type '... Remove this comment to see the full error message
      annotationType,
    } = this.state;
    // @ts-expect-error TS(2532): Object is possibly 'undefined'.
    const colorScheme = getCategoricalSchemeRegistry()
      // @ts-expect-error TS(2339): Property 'colorScheme' does not exist on type 'Rea... Remove this comment to see the full error message
      .get(this.props.colorScheme)
      .colors.concat();
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
          // @ts-expect-error TS(2322): Type '{ ariaLabel: string; name: string; label: st... Remove this comment to see the full error message
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
          onChange={(v: $TSFixMe) => this.setState({ style: v })}
        />
        <SelectControl
          // @ts-expect-error TS(2322): Type '{ ariaLabel: string; name: string; label: st... Remove this comment to see the full error message
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
          onChange={(value: $TSFixMe) => this.setState({ opacity: value })}
        />
        <div>
          <ControlHeader label={t('Color')} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <CompactPicker
              color={color}
              colors={colorScheme}
              onChangeComplete={(v: $TSFixMe) =>
                this.setState({ color: v.hex })
              }
            />
            <Button
              style={{ marginTop: '0.5rem', marginBottom: '0.5rem' }}
              // @ts-expect-error TS(2322): Type '"default" | "success"' is not assignable to ... Remove this comment to see the full error message
              buttonStyle={color === AUTOMATIC_COLOR ? 'success' : 'default'}
              buttonSize="xsmall"
              onClick={() => this.setState({ color: AUTOMATIC_COLOR })}
            >
              {t('Automatic Color')}
            </Button>
          </div>
        </div>
        <TextControl
          // @ts-expect-error TS(2322): Type '{ name: string; label: string; isInt: true; ... Remove this comment to see the full error message
          name="annotation-layer-stroke-width"
          label={t('Line width')}
          isInt
          value={width}
          onChange={v => this.setState({ width: v })}
        />
        // @ts-expect-error TS(2339): Property 'TIME_SERIES' does not exist on type '{}'... Remove this comment to see the full error message
        {annotationType === ANNOTATION_TYPES.TIME_SERIES && (
          <CheckboxControl
            // @ts-expect-error TS(2769): No overload matches this call.
            hovered
            name="annotation-layer-show-markers"
            label={t('Show Markers')}
            description={t('Shows or hides markers for the time series')}
            value={showMarkers}
            onChange={(v: $TSFixMe) => this.setState({ showMarkers: v })}
          />
        )}
        // @ts-expect-error TS(2339): Property 'TIME_SERIES' does not exist on type '{}'... Remove this comment to see the full error message
        {annotationType === ANNOTATION_TYPES.TIME_SERIES && (
          <CheckboxControl
            // @ts-expect-error TS(2769): No overload matches this call.
            hovered
            name="annotation-layer-hide-line"
            label={t('Hide Line')}
            description={t('Hides the Line for the time series')}
            value={hideLine}
            onChange={(v: $TSFixMe) => this.setState({ hideLine: v })}
          />
        )}
      </PopoverSection>
    );
  }

  render() {
    // @ts-expect-error TS(2339): Property 'isNew' does not exist on type 'Readonly<... Remove this comment to see the full error message
    const { isNew, name, annotationType, sourceType, show, showLabel } =
      this.state;
    const isValid = this.isValidForm();
    // @ts-expect-error TS(2339): Property 'vizType' does not exist on type 'Readonl... Remove this comment to see the full error message
    const metadata = getChartMetadataRegistry().get(this.props.vizType);
    const supportedAnnotationTypes = metadata
      ? metadata.supportedAnnotationTypes.map(
          // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
          type => ANNOTATION_TYPES_METADATA[type],
        )
      : [];
    const supportedSourceTypes = this.getSupportedSourceTypes(annotationType);

    return (
      <>
        // @ts-expect-error TS(2339): Property 'error' does not exist on type 'Readonly<... Remove this comment to see the full error message
        {this.props.error && (
          // @ts-expect-error TS(2339): Property 'theme' does not exist on type 'Readonly<... Remove this comment to see the full error message
          <span style={{ color: this.props.theme.colorError }}>
            // @ts-expect-error TS(2339): Property 'error' does not exist on type 'Readonly<... Remove this comment to see the full error message
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
                // @ts-expect-error TS(2322): Type '{ name: string; label: string; placeholder: ... Remove this comment to see the full error message
                name="annotation-layer-name"
                label={t('Name')}
                placeholder=""
                value={name}
                onChange={v => this.setState({ name: v })}
                validationErrors={!name ? [t('Mandatory')] : []}
              />
              <CheckboxControl
                // @ts-expect-error TS(2769): No overload matches this call.
                name="annotation-layer-hide"
                label={t('Hide layer')}
                value={!show}
                onChange={(v: $TSFixMe) => this.setState({ show: !v })}
              />
              <CheckboxControl
                // @ts-expect-error TS(2769): No overload matches this call.
                name="annotation-label-show"
                label={t('Show label')}
                value={showLabel}
                hovered
                description={t('Whether to always show the annotation label')}
                onChange={(v: $TSFixMe) => this.setState({ showLabel: v })}
              />
              <SelectControl
                // @ts-expect-error TS(2322): Type '{ ariaLabel: string; hovered: true; descript... Remove this comment to see the full error message
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
                  // @ts-expect-error TS(2322): Type '{ ariaLabel: string; hovered: true; descript... Remove this comment to see the full error message
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
              // @ts-expect-error TS(2339): Property 'close' does not exist on type 'Readonly<... Remove this comment to see the full error message
              onClick={() => this.props.close()}
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

// @ts-expect-error TS(2339): Property 'propTypes' does not exist on type 'typeo... Remove this comment to see the full error message
AnnotationLayer.propTypes = propTypes;
// @ts-expect-error TS(2339): Property 'defaultProps' does not exist on type 'ty... Remove this comment to see the full error message
AnnotationLayer.defaultProps = defaultProps;

export default withTheme(AnnotationLayer);
