import React, { PropTypes } from 'react';
import LegendItem from './LegendItem';

const propTypes = {
  data: PropTypes.array.isRequired,
  keysToColorsMap: PropTypes.object.isRequired,
};

export default function Legend({ data, keysToColorsMap }) {
  const legendEls = data.map((d) => {
    const color = keysToColorsMap[d.key] ? keysToColorsMap[d.key] : '#000';
    return <LegendItem label={d.key} color={color} key={d.key} />;
  });
  return (
    <ul className="list-unstyled list-inline">
      {legendEls}
    </ul>
  );
}

Legend.propTypes = propTypes;
