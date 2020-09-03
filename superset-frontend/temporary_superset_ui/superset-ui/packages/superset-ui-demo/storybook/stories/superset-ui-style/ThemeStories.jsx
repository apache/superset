import React from 'react';

import { supersetTheme } from '@superset-ui/core';

export default {
  title: 'Core Packages|@superset-ui/style',
};

export const ThemeColors = () => {
  const colors = supersetTheme.colors;
  return Object.keys(colors).map(collection => (
    <div>
      <h2>{collection}</h2>
      <table style={{ width: '300px' }}>
        {Object.keys(colors[collection]).map(k => {
          const hex = colors[collection][k];
          return (
            <tr>
              <td>{k}</td>
              <td>
                <code>{hex}</code>
              </td>
              <td style={{ width: '150px', backgroundColor: hex }}></td>
            </tr>
          );
        })}
      </table>
    </div>
  ));
};
