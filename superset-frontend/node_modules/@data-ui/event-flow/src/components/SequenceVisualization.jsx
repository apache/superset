import React from 'react';
import PropTypes from 'prop-types';

import { withTooltip } from '@vx/tooltip';

import { Group } from '@vx/group';
import EventSequence from './EventSequence';
import EventDetails from './EventDetails';
import Tooltip from './Tooltip';
import XAxis from './XAxis';
import ZeroLine from './ZeroLine';

import { datumShape, scaleShape } from '../propShapes';
import { ENTITY_ID } from '../constants';
import { unit } from '../theme';

export const margin = {
  top: 4 * unit,
  left: 3 * unit,
  right: 3 * unit + 100,
  bottom: 2 * unit,
};

const propTypes = {
  xScale: scaleShape.isRequired,
  yScale: scaleShape.isRequired,
  colorScale: scaleShape.isRequired,
  sequences: PropTypes.arrayOf(PropTypes.arrayOf(datumShape)),
  emphasisIndex: PropTypes.number,
  showTooltip: PropTypes.func,
  hideTooltip: PropTypes.func,
  tooltipData: PropTypes.object, // eslint-disable-line react/forbid-prop-types
  tooltipTop: PropTypes.number,
  tooltipLeft: PropTypes.number,
  tooltipOpen: PropTypes.bool,
};

const defaultProps = {
  sequences: [],
  emphasisIndex: 0,
  showTooltip: () => {},
  hideTooltip: () => {},
  tooltipOpen: false,
  tooltipData: {},
  tooltipTop: 0,
  tooltipLeft: 0,
};

let tooltipTimeout;

function SequenceVisualization({
  xScale,
  yScale,
  colorScale,
  sequences,
  emphasisIndex,
  showTooltip,
  hideTooltip,
  tooltipData,
  tooltipTop,
  tooltipLeft,
  tooltipOpen,
}) {
  const innerWidth = Math.max(...xScale.scale.range());
  const innerHeight = Math.max(...yScale.scale.range());

  return (
    <div>
      <svg
        role="img"
        aria-label="Single event sequences"
        width={innerWidth + margin.left + margin.right}
        height={innerHeight + margin.top + margin.bottom}
      >
        <Group left={margin.left} top={margin.top}>
          <XAxis
            scale={xScale.scale}
            labelOffset={0}
            height={innerHeight}
            tickFormat={xScale.format}
          />

          <ZeroLine xScale={xScale.scale} yScale={yScale.scale} />

          {sequences.map(sequence => (
            <EventSequence
              key={`${(sequence[0] || {})[ENTITY_ID]}-${sequence.length}`}
              sequence={sequence}
              xScale={xScale}
              yScale={yScale}
              colorScale={colorScale}
              emphasisIndex={emphasisIndex}
              onClick={({ event, events, index }) => {
                if (tooltipTimeout) clearTimeout(tooltipTimeout);
                showTooltip({
                  tooltipLeft: xScale.scale(xScale.accessor(event)) + margin.left,
                  tooltipTop: yScale.scale(yScale.accessor(event)) + margin.top,
                  tooltipData: { event, events, index, fromClick: true },
                });
              }}
              onMouseEnter={({ event, events, index }) => {
                if (tooltipTimeout) clearTimeout(tooltipTimeout);
                showTooltip({
                  tooltipLeft: xScale.scale(xScale.accessor(event)) + margin.left,
                  tooltipTop: yScale.scale(yScale.accessor(event)) + margin.top,
                  tooltipData: { event, events, index },
                });
              }}
              onMouseLeave={() => {
                if (!tooltipData.fromClick) {
                  tooltipTimeout = setTimeout(() => {
                    hideTooltip();
                  }, 200);
                }
              }}
            />
          ))}
        </Group>
      </svg>

      {tooltipOpen && (
        <Tooltip left={tooltipLeft} top={tooltipTop} width="auto" detectOverflowY={false}>
          <EventDetails
            xScale={xScale}
            colorScale={colorScale}
            event={tooltipData.event}
            events={tooltipData.events}
            index={tooltipData.index}
          />
        </Tooltip>
      )}
    </div>
  );
}

SequenceVisualization.propTypes = propTypes;
SequenceVisualization.defaultProps = defaultProps;

export default withTooltip(SequenceVisualization);
