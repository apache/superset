import React from 'react';
import PropTypes from 'prop-types';
import Gravatar from 'react-gravatar';

import TooltipWrapper from './TooltipWrapper';

const propTypes = {
  href: PropTypes.string,
  user: PropTypes.object,
  tooltip: PropTypes.node,
  width: PropTypes.string,
  height: PropTypes.string,
  imgStyle: PropTypes.object,
  showTooltip: PropTypes.bool,
  linkToProfile: PropTypes.bool,
};
const defaultProps = {
  imgStyle: { borderRadius: 3 },
  linkToProfile: true,
  showTooltip: true,
};

export default function UserImage(props) {
  let tooltip;
  if (props.showTooltip) {
    tooltip = props.tooltip || props.user.username;
  }
  let href = props.href || '#';
  if (props.linkToProfile) {
    href = `/superset/profile/${props.user.username}/`;
  }
  return (
    <TooltipWrapper label={`user-${props.user.username}`} tooltip={tooltip}>
      <span className="user-icon m-l-3">
        <a href={href}>
          {props.user.image_url ?
            <img
              alt={tooltip || 'User image'}
              src={props.user.image_url}
              width={props.width}
              height={props.height}
              style={props.imgStyle}
            />
          :
            <Gravatar
              email={props.user.email}
              width={props.width}
              height={props.height}
              alt="Profile picture provided by Gravatar"
              className="img-rounded"
              style={props.imgStyle}
            />
          }
        </a>
      </span>
    </TooltipWrapper>
  );
}

UserImage.propTypes = propTypes;
UserImage.defaultProps = defaultProps;
