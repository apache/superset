import React from 'react';
import PropTypes from 'prop-types';
import cx from 'classnames';

import rowStyleOptions from '../../util/rowStyleOptions';
import PopoverDropdown from './PopoverDropdown';

const propTypes = {
  id: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
};

function renderButton(option) {
  return (
    <div className={cx('row-style-option', option.className)}>
      {`${option.label} background`}
    </div>
  );
}

function renderOption(option) {
  return (
    <div className={cx('row-style-option', option.className)}>
      {option.label}
    </div>
  );
}

export default class RowStyleDropdown extends React.PureComponent {
  render() {
    const { id, value, onChange } = this.props;
    return (
      <PopoverDropdown
        id={id}
        options={rowStyleOptions}
        value={value}
        onChange={onChange}
        renderButton={renderButton}
        renderOption={renderOption}
      />
    );
  }
}

RowStyleDropdown.propTypes = propTypes;
