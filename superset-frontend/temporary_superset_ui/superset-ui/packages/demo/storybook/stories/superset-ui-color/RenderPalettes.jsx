/* eslint react/prop-types: 'off' */
import React from 'react';
import './color-styles.css';

export default function RenderPalettes({ title, palettes }) {
  return (
    <div>
      {title && <h2>{title}</h2>}
      <table>
        <tbody>
          {palettes.map(({ colors, id, label }) => (
            <tr key={id}>
              <td className="palette-label">
                <strong>{label}</strong>
              </td>
              <td>
                <div className="palette-container">
                  {colors.map((color, i) => (
                    <div
                      key={color}
                      className="palette-item"
                      style={{
                        backgroundColor: color,
                        marginRight: i === colors.length - 1 ? 0 : 2,
                      }}
                    />
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
