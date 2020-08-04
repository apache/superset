import React from 'react';
import PropTypes from 'prop-types';
import ReactSelect from 'react-select';

import IconChevronDown from './icons/IconChevronDown';
import IconX from './icons/IconX';

const valueShape = PropTypes.oneOfType([PropTypes.string, PropTypes.number]);

const propTypes = {
  arrowRenderer: PropTypes.func,
  autoSize: PropTypes.bool,
  clearable: PropTypes.bool,
  clearRenderer: PropTypes.func,
  optionRenderer: PropTypes.func,
  options: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string,
      value: valueShape.isRequired,
      disabled: PropTypes.bool,
    }),
  ),
  valueRenderer: PropTypes.func,
  value: valueShape,
  onChange: PropTypes.func,
  className: PropTypes.string,
};

const defaultProps = {
  arrowRenderer: () => <IconChevronDown size={18} style={{ marginTop: 10 }} />,
  autoSize: false,
  clearable: false,
  clearRenderer: () => <IconX size={12} style={{ marginTop: 5 }} />,
  optionRenderer: undefined,
  options: [],
  value: null,
  valueRenderer: undefined,
  onChange: () => {},
  className: undefined,
};

function Select({
  arrowRenderer,
  autoSize,
  clearable,
  clearRenderer,
  optionRenderer,
  options,
  className,
  onChange,
  value,
  valueRenderer,
}) {
  return (
    <ReactSelect
      arrowRenderer={arrowRenderer}
      autoSize={autoSize}
      clearable={clearable}
      clearRenderer={clearRenderer}
      optionRenderer={optionRenderer}
      options={options}
      onChange={onChange}
      value={value}
      valueRenderer={valueRenderer}
      className={className}
    />
  );
}

Select.propTypes = propTypes;
Select.defaultProps = defaultProps;

export default Select;
