import PropTypes from 'prop-types';
import { ANNOTATION_TYPES } from '../../modules/AnnotationTypes';

export const numberOrAutoType = PropTypes.oneOfType([
  PropTypes.number,
  PropTypes.oneOf(['auto']),
]);

export const stringOrObjectWithLabelType = PropTypes.oneOfType([
  PropTypes.string,
  PropTypes.shape({
    label: PropTypes.string,
  }),
]);

export const rgbObjectType = PropTypes.shape({
  r: PropTypes.number.isRequired,
  g: PropTypes.number.isRequired,
  b: PropTypes.number.isRequired,
});

export const numericXYType = PropTypes.shape({
  x: PropTypes.number,
  y: PropTypes.number,
});

export const categoryAndValueXYType = PropTypes.shape({
  x: PropTypes.string,
  y: PropTypes.number,
});

export const boxPlotValueType = PropTypes.shape({
  Q1: PropTypes.number,
  Q2: PropTypes.number,
  Q3: PropTypes.number,
  outliers: PropTypes.arrayOf(PropTypes.number),
  whisker_high: PropTypes.number,
  whisker_low: PropTypes.number,
});

export const bulletDataType = PropTypes.shape({
  markerLabels: PropTypes.arrayOf(PropTypes.string),
  markerLineLabels: PropTypes.arrayOf(PropTypes.string),
  markerLines: PropTypes.arrayOf(PropTypes.number),
  markers: PropTypes.arrayOf(PropTypes.number),
  measures: PropTypes.arrayOf(PropTypes.number),
  rangeLabels: PropTypes.arrayOf(PropTypes.string),
  ranges: PropTypes.arrayOf(PropTypes.number),
});

export const annotationLayerType = PropTypes.shape({
  annotationType: PropTypes.oneOf(Object.keys(ANNOTATION_TYPES)),
  color: PropTypes.string,
  name: PropTypes.string,
  hideLine: PropTypes.bool,
  opacity: PropTypes.string,
  show: PropTypes.bool,
  showMarkers: PropTypes.bool,
  sourceType: PropTypes.string,
  style: PropTypes.string,
  value: PropTypes.number,
  width: PropTypes.number,
});
