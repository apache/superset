import React from 'react';

export const Dropdown = ({ children, dropdownRender }: any) => (
  <div data-test="dropdown">
    {children}
    {dropdownRender && dropdownRender()}
  </div>
);

export default Dropdown;