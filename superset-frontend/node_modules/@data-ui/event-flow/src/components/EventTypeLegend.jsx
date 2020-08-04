/* eslint jsx-a11y/no-static-element-interactions: 0 */
import { css, StyleSheet } from 'aphrodite';
import React from 'react';
import PropTypes from 'prop-types';
import { LegendOrdinal } from '@vx/legend';

import { FILTERED_EVENTS } from '../constants';

const styles = StyleSheet.create({
  legendItem: {
    position: 'relative',
    cursor: 'pointer',
    ':before': {
      content: '"✓"',
      color: '#fff',
      position: 'absolute',
      paddingLeft: 2,
    },
  },
});

const propTypes = {
  scale: PropTypes.func.isRequired,
  labelFormat: PropTypes.func,
  onClick: PropTypes.func,
  hiddenEventTypes: PropTypes.objectOf(PropTypes.bool),
};

const defaultProps = {
  labelFormat: label => label,
  onClick: () => {},
  hiddenEventTypes: {
    FILTERED_EVENTS: true,
  },
};

function EventTypeLegend({ scale, labelFormat, hiddenEventTypes, onClick }) {
  return (
    <LegendOrdinal
      direction="column"
      scale={scale}
      shape={({ fill, width, height, label }) => {
        const value = label.datum;
        const isHidden = Boolean(hiddenEventTypes[value]);

        return value === FILTERED_EVENTS ? (
          <svg width={width} height={height}>
            <rect width={width} height={height} fill={fill} />
          </svg>
        ) : (
          <div // eslint-disable-line jsx-a11y/click-events-have-key-events
            className={css(styles.legendItem)}
            onClick={() => {
              onClick(value);
            }}
            style={{
              width,
              height,
              background: isHidden ? 'transparent' : fill,
              boxShadow: isHidden ? `inset 0 0 0 2px ${fill}` : 'none',
            }}
          />
        );
      }}
      fill={({ datum }) => scale(datum)}
      labelFormat={labelFormat}
    />
  );
}

EventTypeLegend.propTypes = propTypes;
EventTypeLegend.defaultProps = defaultProps;

export default EventTypeLegend;
