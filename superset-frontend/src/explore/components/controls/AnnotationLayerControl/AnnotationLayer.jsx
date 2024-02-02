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
import React from 'react';
import rison from 'rison';
import PropTypes from 'prop-types';
import { CompactPicker } from 'react-color';
import Button from 'src/components/Button';
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
import PopoverSection from 'src/components/PopoverSection';
import ControlHeader from 'src/explore/components/ControlHeader';
import { EmptyStateSmall } from 'src/components/EmptyState';
import { FILTER_OPTIONS_LIMIT } from 'src/explore/constants';
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
    <EmptyStateSmall
      title={t('No annotation layers')}
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

class AnnotationLayer extends React.PureComponent {
  constructor(props) {
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
      isLoadingOptions: true,
      valueOptions: [],
    };
    this.submitAnnotation = this.submitAnnotation.bind(this);
    this.deleteAnnotation = this.deleteAnnotation.bind(this);
    this.applyAnnotation = this.applyAnnotation.bind(this);
    this.fetchOptions = this.fetchOptions.bind(this);
    this.handleAnnotationType = this.handleAnnotationType.bind(this);
    this.handleAnnotationSourceType =
      this.handleAnnotationSourceType.bind(this);
    this.handleValue = this.handleValue.bind(this);
    this.isValidForm = this.isValidForm.bind(this);
  }

  componentDidMount() {
    const { annotationType, sourceType, isLoadingOptions } = this.state;
    this.fetchOptions(annotationType, sourceType, isLoadingOptions);
  }

  componentDidUpdate(prevProps, prevState) {
    if (prevState.sourceType !== this.state.sourceType) {
      this.fetchOptions(this.state.annotationType, this.state.sourceType, true);
    }
  }

  getSupportedSourceTypes(annotationType) {
    // Get vis types that can be source.
    const sources = getChartMetadataRegistry()
      .entries()
      .filter(({ value: chartMetadata }) =>
        chartMetadata.canBeAnnotationType(annotationType),
      )
      .map(({ key, value: chartMetadata }) => ({
        value: key,
        label: chartMetadata.name,
      }));
    // Prepend native source if applicable
    if (ANNOTATION_TYPES_METADATA[annotationType]?.supportNativeSource) {
      sources.unshift(ANNOTATION_SOURCE_TYPES_METADATA.NATIVE);
    }
    return sources;
  }

  isValidFormulaAnnotation(expression, annotationType) {
    if (annotationType === ANNOTATION_TYPES.FORMULA) {
      return isValidExpression(expression);
    }
    return true;
  }

  isValidForm() {
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
    errors.push(!this.isValidFormulaAnnotation(value, annotationType));
    return !errors.filter(x => x).length;
  }

  handleAnnotationType(annotationType) {
    this.setState({
      annotationType,
      sourceType: null,
      value: null,
    });
  }

  handleAnnotationSourceType(sourceType) {
    const { sourceType: prevSourceType } = this.state;

    if (prevSourceType !== sourceType) {
      this.setState({ sourceType, value: null, isLoadingOptions: true });
    }
  }

  handleValue(value) {
    this.setState({
      value,
      descriptionColumns: [],
      intervalEndColumn: null,
      timeColumn: null,
      titleColumn: null,
      overrides: { time_range: null },
    });
  }

  fetchOptions(annotationType, sourceType, isLoadingOptions) {
    if (isLoadingOptions) {
      if (sourceType === ANNOTATION_SOURCE_TYPES.NATIVE) {
        const queryParams = rison.encode({
          page: 0,
          page_size: FILTER_OPTIONS_LIMIT,
        });
        SupersetClient.get({
          endpoint: `/api/v1/annotation_layer/?q=${queryParams}`,
        }).then(({ json }) => {
          const layers = json
            ? json.result.map(layer => ({
                value: layer.id,
                label: layer.name,
              }))
            : [];
          this.setState({
            isLoadingOptions: false,
            valueOptions: layers,
          });
        });
      } else if (requiresQuery(sourceType)) {
        const queryParams = rison.encode({
          filters: [
            {
              col: 'id',
              opr: 'chart_owned_created_favored_by_me',
              value: true,
            },
          ],
          order_column: 'slice_name',
          order_direction: 'asc',
          page: 0,
          page_size: FILTER_OPTIONS_LIMIT,
        });
        SupersetClient.get({
          endpoint: `/api/v1/chart/?q=${queryParams}`,
        }).then(({ json }) => {
          const registry = getChartMetadataRegistry();
          this.setState({
            isLoadingOptions: false,
            valueOptions: json.result
              .filter(x => {
                const metadata = registry.get(x.viz_type);
                return metadata && metadata.canBeAnnotationType(annotationType);
              })
              .map(x => ({
                value: x.id,
                label: x.slice_name,
                slice: {
                  ...x,
                  data: {
                    ...x.form_data,
                    groupby: x.form_data.groupby?.map(column =>
                      getColumnLabel(column),
                    ),
                  },
                },
              })),
          });
        });
      } else {
        this.setState({
          isLoadingOptions: false,
          valueOptions: [],
        });
      }
    }
  }

  deleteAnnotation() {
    this.props.removeAnnotationLayer();
    this.props.close();
  }

  applyAnnotation() {
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
        'value',
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
        if (this.state[field] !== null) {
          newAnnotation[field] = this.state[field];
        }
      });

      if (newAnnotation.color === AUTOMATIC_COLOR) {
        newAnnotation.color = null;
      }

      this.props.addAnnotationLayer(newAnnotation);
      this.setState({ isNew: false });
    }
  }

  submitAnnotation() {
    this.applyAnnotation();
    this.props.close();
  }

  renderOption(option) {
    return (
      <span
        css={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        title={option.label}
      >
        {option.label}
      </span>
    );
  }

  renderValueConfiguration() {
    const {
      annotationType,
      sourceType,
      value,
      valueOptions,
      isLoadingOptions,
    } = this.state;
    let label = '';
    let description = '';
    if (requiresQuery(sourceType)) {
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
    if (requiresQuery(sourceType)) {
      return (
        <SelectControl
          ariaLabel={t('Annotation layer value')}
          name="annotation-layer-value"
          showHeader
          hovered
          description={description}
          label={label}
          placeholder=""
          options={valueOptions}
          isLoading={isLoadingOptions}
          value={value}
          onChange={this.handleValue}
          validationErrors={!value ? ['Mandatory'] : []}
          optionRenderer={this.renderOption}
          notFoundContent={<NotFoundContent />}
        />
      );
    }
    if (annotationType === ANNOTATION_TYPES.FORMULA) {
      return (
        <TextControl
          name="annotation-layer-value"
          hovered
          showHeader
          description={description}
          label={label}
          placeholder=""
          value={value}
          onChange={this.handleValue}
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
      annotationType,
      sourceType,
      value,
      valueOptions,
      overrides,
      titleColumn,
      timeColumn,
      intervalEndColumn,
      descriptionColumns,
    } = this.state;
    const { slice } = valueOptions.find(x => x.value === value) || {};
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
                onChange={v => this.setState({ timeColumn: v })}
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
                onChange={value => this.setState({ intervalEndColumn: value })}
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
              onChange={value => this.setState({ titleColumn: value })}
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
                onChange={value => this.setState({ descriptionColumns: value })}
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

  renderDisplayConfiguration() {
    const {
      color,
      opacity,
      style,
      width,
      showMarkers,
      hideLine,
      annotationType,
    } = this.state;
    const colorScheme = getCategoricalSchemeRegistry()
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
          onChange={v => this.setState({ style: v })}
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
          onChange={value => this.setState({ opacity: value })}
        />
        <div>
          <ControlHeader label={t('Color')} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <CompactPicker
              color={color}
              colors={colorScheme}
              onChangeComplete={v => this.setState({ color: v.hex })}
            />
            <Button
              style={{ marginTop: '0.5rem', marginBottom: '0.5rem' }}
              buttonStyle={color === AUTOMATIC_COLOR ? 'success' : 'default'}
              buttonSize="xsmall"
              onClick={() => this.setState({ color: AUTOMATIC_COLOR })}
            >
              {t('Automatic Color')}
            </Button>
          </div>
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

  render() {
    const { isNew, name, annotationType, sourceType, show, showLabel } =
      this.state;
    const isValid = this.isValidForm();
    const metadata = getChartMetadataRegistry().get(this.props.vizType);
    const supportedAnnotationTypes = metadata
      ? metadata.supportedAnnotationTypes.map(
          type => ANNOTATION_TYPES_METADATA[type],
        )
      : [];
    const supportedSourceTypes = this.getSupportedSourceTypes(annotationType);

    return (
      <>
        {this.props.error && (
          <span style={{ color: this.props.theme.colors.error.base }}>
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
            <Button buttonSize="small" onClick={() => this.props.close()}>
              {t('Cancel')}
            </Button>
          ) : (
            <Button buttonSize="small" onClick={this.deleteAnnotation}>
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

AnnotationLayer.propTypes = propTypes;
AnnotationLayer.defaultProps = defaultProps;

export default withTheme(AnnotationLayer);
