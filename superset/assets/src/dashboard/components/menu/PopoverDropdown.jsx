import React from 'react';
import PropTypes from 'prop-types';
import { DropdownButton, MenuItem } from 'react-bootstrap';

const propTypes = {
  id: PropTypes.string.isRequired,
  options: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      className: PropTypes.string,
    }),
  ).isRequired,
  onChange: PropTypes.func.isRequired,
  value: PropTypes.string.isRequired,
  renderButton: PropTypes.func,
  renderOption: PropTypes.func,
};

const defaultProps = {
  renderButton: option => option.label,
  renderOption: option => (
    <div className={option.className}>{option.label}</div>
  ),
};

class PopoverDropdown extends React.PureComponent {
  constructor(props) {
    super(props);
    this.handleSelect = this.handleSelect.bind(this);
  }

  handleSelect(nextValue) {
    this.props.onChange(nextValue);
  }

  render() {
    const { id, value, options, renderButton, renderOption } = this.props;
    const selected = options.find(opt => opt.value === value);
    return (
      <DropdownButton
        id={id}
        bsSize="small"
        title={renderButton(selected)}
        className="popover-dropdown"
      >
        {options.map(option => (
          <MenuItem
            key={option.value}
            eventKey={option.value}
            active={option.value === value}
            onSelect={this.handleSelect}
            className="dropdown-item"
          >
            {renderOption(option)}
          </MenuItem>
        ))}
      </DropdownButton>
    );
  }
}

PopoverDropdown.propTypes = propTypes;
PopoverDropdown.defaultProps = defaultProps;

export default PopoverDropdown;
