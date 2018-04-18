import React from 'react';
import PropTypes from 'prop-types';
import { MenuItem } from 'react-bootstrap';

import InfoTooltipWithTrigger from '../../components/InfoTooltipWithTrigger';

export function MenuItemContent({ faIcon, text, tooltip, children }) {
  return (
    <span>
      {faIcon &&
        <i className={`fa fa-${faIcon}`}>&nbsp;</i>
      }
      {text} {''}
      <InfoTooltipWithTrigger
        tooltip={tooltip}
        label={faIcon ? `dash-${faIcon}`: ''}
        placement="top"
      />
      {children}
    </span>
  );
}
MenuItemContent.propTypes = {
  faIcon: PropTypes.string,
  text: PropTypes.string,
  tooltip: PropTypes.string,
  children: PropTypes.node,
};

export function ActionMenuItem(props) {
  return (
    <MenuItem
      onClick={props.onClick}
      href={props.href}
      target={props.target}
    >
      <MenuItemContent {...props} />
    </MenuItem>
  );
}
ActionMenuItem.propTypes = {
  onClick: PropTypes.func,
};