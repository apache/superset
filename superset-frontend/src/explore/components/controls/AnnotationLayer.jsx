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
import PropTypes from 'prop-types';
import { CompactPicker } from 'react-color';
import Button from 'src/components/Button';
import mathjs from 'mathjs';
import {
  t,
  SupersetClient,
  getCategoricalSchemeRegistry,
  getChartMetadataRegistry,
  ThemeProvider,
  validateNonEmpty,
} from '@superset-ui/core';

import SelectControl from './SelectControl';
import TextControl from './TextControl';
import CheckboxControl from './CheckboxControl';

import ANNOTATION_TYPES, {
  ANNOTATION_SOURCE_TYPES,
  ANNOTATION_TYPES_METADATA,
  DEFAULT_ANNOTATION_TYPE,
  requiresQuery,
  ANNOTATION_SOURCE_TYPES_METADATA,
} from '../../../modules/AnnotationTypes';

import PopoverSection from '../../../components/PopoverSection';
import ControlHeader from '../ControlHeader';
import './AnnotationLayer.less';

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
  titleColumn: PropTypes.string,
  descriptionColumns: PropTypes.arrayOf(PropTypes.string),
  timeColumn: PropTypes.string,
  intervalEndColumn: PropTypes.string,
  vizType: PropTypes.string,
  theme: PropTypes.object,

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
  titleColumn: '',
  descriptionColumns: [],
  timeColumn: '',
  intervalEndColumn: '',

  addAnnotationLayer: () => {},
  removeAnnotationLayer: () => {},
  close: () => {},
};

export default class AnnotationLayer extends React.PureComponent {
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
      titleColumn,
      descriptionColumns,
      timeColumn,
      intervalEndColumn,
    } = props;

    const overridesKeys = Object.keys(overrides);
    if (overridesKeys.includes('since') || overridesKeys.includes('until')) {
      overrides.time_range = null;
      delete overrides.since;
      delete overrides.until;
    }

    this.state = {
      // base
      name,
      oldName: !this.props.name ? null : name,
      annotationType,
      sourceType,
      value,
      overrides,
      show,
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
      isNew: !this.props.name,
      isLoadingOptions: true,
      valueOptions: [],
      validationErrors: {},
    };
    this.submitAnnotation = this.submitAnnotation.bind(this);
    this.deleteAnnotation = this.deleteAnnotation.bind(this);
    this.applyAnnotation = this.applyAnnotation.bind(this);
    this.fetchOptions = this.fetchOptions.bind(this);
    this.handleAnnotationType = this.handleAnnotationType.bind(this);
    this.handleAnnotationSourceType = this.handleAnnotationSourceType.bind(
      this,
    );
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
    if (ANNOTATION_TYPES_METADATA[annotationType].supportNativeSource) {
      sources.unshift(ANNOTATION_SOURCE_TYPES_METADATA.NATIVE);
    }
    return sources;
  }

  isValidFormula(value, annotationType) {
    if (annotationType === ANNOTATION_TYPES.FORMULA) {
      try {
        mathjs.parse(value).compile().eval({ x: 0 });
      } catch (err) {
        return true;
      }
    }
    return false;
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
    errors.push(this.isValidFormula(value, annotationType));
    return !errors.filter(x => x).length;
  }

  handleAnnotationType(annotationType) {
    this.setState({
      annotationType,
      sourceType: null,
      validationErrors: {},
      value: null,
    });
  }

  handleAnnotationSourceType(sourceType) {
    const { sourceType: prevSourceType } = this.state;

    if (prevSourceType !== sourceType) {
      this.setState({
        sourceType,
        isLoadingOptions: true,
        validationErrors: {},
        value: null,
      });
    }
  }

  handleValue(value) {
    this.setState({
      value,
      descriptionColumns: null,
      intervalEndColumn: null,
      timeColumn: null,
      titleColumn: null,
      overrides: { time_range: null },
    });
  }

  fetchOptions(annotationType, sourceType, isLoadingOptions) {
    if (isLoadingOptions === true) {
      if (sourceType === ANNOTATION_SOURCE_TYPES.NATIVE) {
        SupersetClient.get({
          endpoint: '/annotationlayermodelview/api/read?',
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
        SupersetClient.get({ endpoint: '/superset/user_slices' }).then(
          ({ json }) => {
            const registry = getChartMetadataRegistry();
            this.setState({
              isLoadingOptions: false,
              valueOptions: json
                .filter(x => {
                  const metadata = registry.get(x.viz_type);
                  return (
                    metadata && metadata.canBeAnnotationType(annotationType)
                  );
                })
                .map(x => ({ value: x.id, label: x.title, slice: x })),
            });
          },
        );
      } else {
        this.setState({
          isLoadingOptions: false,
          valueOptions: [],
        });
      }
    }
  }

  deleteAnnotation() {
    this.props.close();
    if (!this.state.isNew) {
      this.props.removeAnnotationLayer(this.state);
    }
  }

  applyAnnotation() {
    if (this.state.name.length) {
      const annotation = {};
      Object.keys(this.state).forEach(k => {
        if (this.state[k] !== null) {
          annotation[k] = this.state[k];
        }
      });
      delete annotation.isNew;
      delete annotation.valueOptions;
      delete annotation.isLoadingOptions;
      delete annotation.validationErrors;
      annotation.color =
        annotation.color === AUTOMATIC_COLOR ? null : annotation.color;
      this.props.addAnnotationLayer(annotation);
      this.setState({ isNew: false, oldName: this.state.name });
    }
  }

  submitAnnotation() {
    this.applyAnnotation();
    this.props.close();
  }

  renderOption(option) {
    return (
      <span className="optionWrapper" title={option.label}>
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
        label = 'Annotation Layer';
        description = 'Select the Annotation Layer you would like to use.';
      } else {
        label = label = t('Chart');
        description = `Use a pre defined Superset Chart as a source for annotations and overlays.
        your chart must be one of these visualization types:
        [${this.getSupportedSourceTypes(annotationType)
          .map(x => x.label)
          .join(', ')}]`;
      }
    } else if (annotationType === ANNOTATION_TYPES.FORMULA) {
      label = 'Formula';
      description = `Expects a formula with depending time parameter 'x'
        in milliseconds since epoch. mathjs is used to evaluate the formulas.
        Example: '2x+5'`;
    }
    if (requiresQuery(sourceType)) {
      return (
        <SelectControl
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
            this.isValidFormula(value, annotationType) ? ['Bad formula.'] : []
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
            onSelect={() => {}}
            title="Annotation Slice Configuration"
            info={`This section allows you to configure how to use the slice
               to generate annotations.`}
          >
            {(annotationType === ANNOTATION_TYPES.EVENT ||
              annotationType === ANNOTATION_TYPES.INTERVAL) && (
              <SelectControl
                hovered
                name="annotation-layer-time-column"
                label={
                  annotationType === ANNOTATION_TYPES.INTERVAL
                    ? 'Interval Start column'
                    : 'Event Time Column'
                }
                description={'This column must contain date/time information.'}
                validationErrors={!timeColumn ? ['Mandatory'] : []}
                clearable={false}
                options={timeColumnOptions}
                value={timeColumn}
                onChange={v => this.setState({ timeColumn: v })}
              />
            )}
            {annotationType === ANNOTATION_TYPES.INTERVAL && (
              <SelectControl
                hovered
                name="annotation-layer-intervalEnd"
                label="Interval End column"
                description={'This column must contain date/time information.'}
                validationErrors={!intervalEndColumn ? ['Mandatory'] : []}
                options={columns}
                value={intervalEndColumn}
                onChange={v => this.setState({ intervalEndColumn: v })}
              />
            )}
            <SelectControl
              hovered
              name="annotation-layer-title"
              label="Title Column"
              description={'Pick a title for you annotation.'}
              options={[{ value: '', label: 'None' }].concat(columns)}
              value={titleColumn}
              onChange={v => this.setState({ titleColumn: v })}
            />
            {annotationType !== ANNOTATION_TYPES.TIME_SERIES && (
              <SelectControl
                hovered
                name="annotation-layer-title"
                label="Description Columns"
                description={`Pick one or more columns that should be shown in the
                  annotation. If you don't select a column all of them will be shown.`}
                multi
                options={columns}
                value={descriptionColumns}
                onChange={v => this.setState({ descriptionColumns: v })}
              />
            )}
            <div style={{ marginTop: '1rem' }}>
              <CheckboxControl
                hovered
                name="annotation-override-time_range"
                label="Override time range"
                description={`This controls whether the "time_range" field from the current
                  view should be passed down to the chart containing the annotation data.`}
                value={!!Object.keys(overrides).find(x => x === 'time_range')}
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
                label="Override time grain"
                description={`This controls whether the time grain field from the current
                  view should be passed down to the chart containing the annotation data.`}
                value={
                  !!Object.keys(overrides).find(x => x === 'time_grain_sqla')
                }
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
                label="Time Shift"
                description={`Time delta in natural language
                  (example:  24 hours, 7 days, 56 weeks, 365 days)`}
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
        onSelect={() => {}}
        title={t('Display configuration')}
        info={t('Configure your how you overlay is displayed here.')}
      >
        <SelectControl
          name="annotation-layer-stroke"
          label={t('Style')}
          // see '../../../visualizations/nvd3_vis.css'
          options={[
            { value: 'solid', label: 'Solid' },
            { value: 'dashed', label: 'Dashed' },
            { value: 'longDashed', label: 'Long Dashed' },
            { value: 'dotted', label: 'Dotted' },
          ]}
          value={style}
          onChange={v => this.setState({ style: v })}
        />
        <SelectControl
          name="annotation-layer-opacity"
          label={t('Opacity')}
          // see '../../../visualizations/nvd3_vis.css'
          options={[
            { value: '', label: 'Solid' },
            { value: 'opacityLow', label: '0.2' },
            { value: 'opacityMedium', label: '0.5' },
            { value: 'opacityHigh', label: '0.8' },
          ]}
          value={opacity}
          onChange={v => this.setState({ opacity: v })}
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
              Automatic Color
            </Button>
          </div>
        </div>
        <TextControl
          name="annotation-layer-stroke-width"
          label={t('Line Width')}
          isInt
          value={width}
          onChange={v => this.setState({ width: v })}
        />
        {annotationType === ANNOTATION_TYPES.TIME_SERIES && (
          <CheckboxControl
            hovered
            name="annotation-layer-show-markers"
            label="Show Markers"
            description={'Shows or hides markers for the time series'}
            value={showMarkers}
            onChange={v => this.setState({ showMarkers: v })}
          />
        )}
        {annotationType === ANNOTATION_TYPES.TIME_SERIES && (
          <CheckboxControl
            hovered
            name="annotation-layer-hide-line"
            label="Hide Line"
            description={'Hides the Line for the time series'}
            value={hideLine}
            onChange={v => this.setState({ hideLine: v })}
          />
        )}
      </PopoverSection>
    );
  }

  render() {
    const { isNew, name, annotationType, sourceType, show } = this.state;
    const isValid = this.isValidForm();
    const { theme } = this.props;
    const metadata = getChartMetadataRegistry().get(this.props.vizType);
    const supportedAnnotationTypes = metadata
      ? metadata.supportedAnnotationTypes.map(
          type => ANNOTATION_TYPES_METADATA[type],
        )
      : [];
    const supportedSourceTypes = this.getSupportedSourceTypes(annotationType);

    return (
      <ThemeProvider theme={theme}>
        {this.props.error && (
          <span style={{ color: 'red' }}>ERROR: {this.props.error}</span>
        )}
        <div style={{ display: 'flex', flexDirection: 'row' }}>
          <div style={{ marginRight: '2rem' }}>
            <PopoverSection
              isSelected
              onSelect={() => {}}
              title={t('Layer Configuration')}
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
                label={t('Hide Layer')}
                value={!show}
                onChange={v => this.setState({ show: !v })}
              />
              <SelectControl
                hovered
                description={t('Choose the Annotation Layer Type')}
                label={t('Annotation Layer Type')}
                name="annotation-layer-type"
                options={supportedAnnotationTypes}
                value={annotationType}
                onChange={this.handleAnnotationType}
              />
              {!!supportedSourceTypes.length && (
                <SelectControl
                  hovered
                  description="Choose the source of your annotations"
                  label="Annotation Source"
                  name="annotation-source-type"
                  options={supportedSourceTypes}
                  value={sourceType}
                  onChange={this.handleAnnotationSourceType}
                />
              )}
              {this.renderValueConfiguration()}
            </PopoverSection>
          </div>
          {this.renderSliceConfiguration()}
          {this.renderDisplayConfiguration()}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Button buttonSize="sm" onClick={this.deleteAnnotation}>
            {!isNew ? t('Remove') : t('Cancel')}
          </Button>
          <div>
            <Button
              buttonSize="sm"
              disabled={!isValid}
              onClick={this.applyAnnotation}
            >
              {t('Apply')}
            </Button>

            <Button
              buttonSize="sm"
              disabled={!isValid}
              onClick={this.submitAnnotation}
            >
              {t('OK')}
            </Button>
          </div>
        </div>
      </ThemeProvider>
    );
  }
}

AnnotationLayer.propTypes = propTypes;
AnnotationLayer.defaultProps = defaultProps;
