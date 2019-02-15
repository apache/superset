import React from 'react';
import { CategoricalColorNamespace } from '@superset-ui/color';
import { LegendOrdinal, LegendItem, LegendLabel } from '@vx/legend';
import { scaleOrdinal } from '@vx/scale';

export default function renderLegend(data, colorEncoding) {
  const { field, scale } = colorEncoding;
  const { scheme, namespace } = scale;
  const colorFn = CategoricalColorNamespace.getScale(scheme, namespace);
  const keySet = new Set();
  data.forEach(d => {
    keySet.add(d[field]);
  });
  const keys = [...keySet.values()];
  const colorScale = scaleOrdinal({
    domain: keys,
    range: keys.map(colorFn),
  });

  return (
    <div
      style={{
        maxHeight: 100,
        overflowY: 'hidden',
        paddingLeft: 14,
        paddingTop: 6,
        position: 'relative',
      }}
    >
      <LegendOrdinal scale={colorScale} labelFormat={label => label}>
        {labels => (
          <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap' }}>
            {labels.map((label, i) => {
              const size = 8;

              return (
                <LegendItem
                  key={`legend-quantile-${i}`}
                  margin="0 5px"
                  onClick={event => {
                    alert(`clicked: ${JSON.stringify(label)}`);
                  }}
                >
                  <svg width={size} height={size} style={{ display: 'inline-block' }}>
                    <rect fill={label.value} width={size} height={size} />
                  </svg>
                  <LegendLabel align="left" margin="0 0 0 4px">
                    {label.text}
                  </LegendLabel>
                </LegendItem>
              );
            })}
          </div>
        )}
      </LegendOrdinal>
    </div>
  );
}
