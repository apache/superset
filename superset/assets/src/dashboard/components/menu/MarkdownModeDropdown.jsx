import React from 'react';
import PropTypes from 'prop-types';
import { t } from '../../../locales';

import PopoverDropdown from './PopoverDropdown';

const propTypes = {
  id: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
};

const dropdownOptions = [
  {
    value: 'edit',
    label: t('Edit'),
  },
  {
    value: 'preview',
    label: t('Preview'),
  },
];

export default class MarkdownModeDropdown extends React.PureComponent {
  render() {
    const { id, value, onChange } = this.props;

    return (
      <PopoverDropdown
        id={id}
        options={dropdownOptions}
        value={value}
        onChange={onChange}
      />
    );
  }
}

MarkdownModeDropdown.propTypes = propTypes;
