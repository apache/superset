import PropTypes from 'prop-types';
import React from 'react';

import { Bar, Line } from '@vx/shape';
import { Point } from '@vx/point';
import { GlyphCircle } from '@vx/glyph';
import { Group } from '@vx/group';

import { EVENT_UUID } from '../constants';
import { scaleShape } from '../propShapes';
import { yTickStyles } from '../theme';

const CIRCLE_RADIUS = 5;
const MAX_NAME_LENGTH = 12;

const propTypes = {
  sequence: PropTypes.arrayOf(PropTypes.object),
  xScale: scaleShape.isRequired,
  yScale: scaleShape.isRequired,
  colorScale: scaleShape.isRequired,
  emphasisIndex: PropTypes.number,
  onClick: PropTypes.func,
  onMouseEnter: PropTypes.func,
  onMouseLeave: PropTypes.func,
};

const defaultProps = {
  sequence: [],
  emphasisIndex: NaN,
  onClick: () => {}, // ({ event, events, index })
  onMouseEnter: () => {}, // ({ event, events, index })
  onMouseLeave: () => {}, // ({ event, events, index })
};

function EventSequence({
  sequence,
  xScale,
  yScale,
  colorScale,
  emphasisIndex,
  onClick,
  onMouseEnter,
  onMouseLeave,
}) {
  const firstEvent = sequence[0];
  const entityId = yScale.accessor(firstEvent || {});
  const { zeroIndex } = sequence;
  const y = yScale.scale(entityId);
  const [xMin, xMax] = xScale.scale.range();
  const innerWidth = Math.max(xMin, xMax);
  const emphasizeBounds = [];

  const events = sequence.map((event, index) => {
    const x = xScale.scale(xScale.accessor(event));
    const color = colorScale.scale(colorScale.accessor(event));
    const relativeIndex = index - zeroIndex;
    if (relativeIndex === 0) emphasizeBounds[0] = x;
    if (relativeIndex === emphasisIndex) emphasizeBounds[1] = x;

    return (
      <GlyphCircle
        key={`${event[EVENT_UUID]}`}
        style={{ cursor: 'pointer' }}
        left={x}
        top={y}
        r={CIRCLE_RADIUS}
        cx={0}
        cy={0}
        fillOpacity={0.75}
        fill={color}
        stroke={relativeIndex === 0 ? '#000' : '#fff'}
        strokeWidth={1}
        onClick={() => () => {
          onClick({ event, index, events: sequence });
        }}
        onMouseEnter={() => () => {
          onMouseEnter({ event, index, events: sequence });
        }}
        onMouseLeave={() => () => {
          onMouseLeave({ event, index, events: sequence });
        }}
      />
    );
  });

  const emphasisMin = Math.min(...emphasizeBounds);
  const emphasisMax = Math.max(...emphasizeBounds);
  const entityLabel =
    entityId.length > MAX_NAME_LENGTH ? `${entityId.slice(0, MAX_NAME_LENGTH + 1)}…` : entityId;

  return (
    <Group>
      {/* gridline for this sequence */}
      <Line
        from={new Point({ x: xMin, y })}
        to={new Point({ x: xMax, y })}
        strokeWidth={1}
        stroke="#DBDBDB"
      />

      {/* label for this sequence */}
      <text x={innerWidth + 8} y={y} {...yTickStyles.label.right}>
        {entityLabel}
      </text>

      {/* a mark that emphasizes the selected sequence */}
      <Bar
        fill="#DBDBDB"
        rx={CIRCLE_RADIUS}
        ry={CIRCLE_RADIUS}
        x={emphasisMin}
        y={y - CIRCLE_RADIUS / 2}
        width={emphasisMax - emphasisMin}
        height={CIRCLE_RADIUS + 1}
      />

      {events}
    </Group>
  );
}

EventSequence.propTypes = propTypes;
EventSequence.defaultProps = defaultProps;

export default EventSequence;
