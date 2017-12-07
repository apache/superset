import React from 'react';
import PropTypes from 'prop-types';
import InfoTooltipWithTrigger from './InfoTooltipWithTrigger';

const propTypes = {
  title: PropTypes.string.isRequired,
  isSelected: PropTypes.bool.isRequired,
  onSelect: PropTypes.func.isRequired,
  info: PropTypes.string,
  children: PropTypes.node.isRequired,
};

export default function PopoverSection({ title, isSelected, children, onSelect, info }) {
  return (
    <div className={'PopoverSection ' + (!isSelected ? 'dimmed' : '')}>
      <div onClick={onSelect} className="pointer">
        <strong>{title}</strong> &nbsp;
        {info &&
          <InfoTooltipWithTrigger
            tooltip={info}
            label="date-free-tooltip"
          />}
        &nbsp;
        <i className={isSelected ? 'fa fa-check text-primary' : ''} />
      </div>
      <div className="m-t-5 m-l-5">
        {children}
      </div>
    </div>);
}
PopoverSection.propTypes = propTypes;
