import React from 'react';

const ColorSchemeControl = ({ value, onChange }: any) => (
  <div data-test="color-scheme-control">
    <select value={value} onChange={e => onChange(e.target.value)}>
      <option value="default">Default</option>
    </select>
  </div>
);

export default ColorSchemeControl;