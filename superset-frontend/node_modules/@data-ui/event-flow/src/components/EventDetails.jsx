import PropTypes from 'prop-types';
import React from 'react';
import { formatInterval } from '../utils/scale-utils';
import { datumShape, scaleShape } from '../propShapes';

import { font } from '../theme';

import { ENTITY_ID, EVENT_NAME, META } from '../constants';

const propTypes = {
  event: datumShape,
  events: PropTypes.arrayOf(datumShape),
  index: PropTypes.number,
  xScale: scaleShape,
  colorScale: scaleShape,
};

const defaultProps = {
  event: {},
  events: [],
  index: -1,
  xScale: null,
  colorScale: null,
};

function EventDetails({ event, events, index, xScale, colorScale }) {
  if (!xScale || !colorScale) return null;
  const eventName = event[EVENT_NAME];
  const entity = event[ENTITY_ID];
  const prettyMeta = JSON.stringify(event[META], null, 2);

  const prevEvent = index - 1 > 0 ? events[index - 1] : null;
  const color = colorScale.scale(colorScale.accessor(event));
  const rootColor = colorScale.scale(colorScale.accessor(events[0]));
  const prevColor = prevEvent ? colorScale.scale(colorScale.accessor(prevEvent)) : null;
  const elapsedToRoot = xScale.accessor(event);
  const elapsedToPrev = prevEvent ? elapsedToRoot - xScale.accessor(prevEvent) : null;

  return (
    <div>
      <div style={{ color, ...font.medium, ...font.bold }}>{eventName}</div>
      <div style={{ ...font.small, ...font.light }}>
        <div>
          <strong>Entity</strong> {entity}
        </div>

        {index > 0 && (
          <div>
            <strong>Time </strong>
            <span style={{ color: rootColor }}>{formatInterval(elapsedToRoot)} (root)</span>

            {prevEvent && ', '}
            {prevEvent && (
              <span style={{ color: prevColor }}>{formatInterval(elapsedToPrev)} (prev)</span>
            )}
          </div>
        )}
        {prettyMeta && (
          <pre style={{ ...font.small, ...font.light }}>
            <strong>Meta </strong>
            {prettyMeta}
          </pre>
        )}
      </div>
    </div>
  );
}

EventDetails.propTypes = propTypes;
EventDetails.defaultProps = defaultProps;

export default EventDetails;
