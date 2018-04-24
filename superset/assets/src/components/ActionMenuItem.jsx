import React from 'react';
import PropTypes from 'prop-types';
import { MenuItem } from 'react-bootstrap';

import InfoTooltipWithTrigger from './InfoTooltipWithTrigger';

export function MenuItemContent({ faIcon, text, tooltip, children }) {
  return (
    <span>
      {faIcon && <i className={`fa fa-${faIcon}`}>&nbsp;</i>}
      {text} {''}
      <InfoTooltipWithTrigger
        tooltip={tooltip}
        label={faIcon ? `dash-${faIcon}` : ''}
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

MenuItemContent.defaultProps = {
  faIcon: '',
  text: '',
  tooltip: null,
  children: null,
};

export function ActionMenuItem({
  onClick,
  href,
  target,
  text,
  tooltip,
  children,
  faIcon,
}) {
  return (
    <MenuItem onClick={onClick} href={href} target={target}>
      <MenuItemContent faIcon={faIcon} text={text} tooltip={tooltip}>
        {children}
      </MenuItemContent>
    </MenuItem>
  );
}

ActionMenuItem.propTypes = {
  onClick: PropTypes.func,
  href: PropTypes.string,
  target: PropTypes.string,
  ...MenuItemContent.propTypes,
};

ActionMenuItem.defaultProps = {
  onClick() {},
  href: null,
  target: null,
};
