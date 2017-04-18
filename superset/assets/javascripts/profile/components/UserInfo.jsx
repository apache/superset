import React from 'react';
import PropTypes from 'prop-types';
import moment from 'moment';
import { Label, Panel } from 'react-bootstrap';
import UserImage from '../../components/UserImage';

const propTypes = {
  user: PropTypes.object.isRequired,
};
const UserInfo = ({ user }) => (
  <div>
    <UserImage width="100%" user={user} showTooltip={false} linkToProfile={false} />
    <hr />
    <Panel>
      <h3>
        <strong>{user.first_name} {user.last_name}</strong>
      </h3>
      <h4 className="username">
        <i className="fa fa-user-o" /> {user.username}
      </h4>
      <hr />
      <p>
        <i className="fa fa-clock-o" /> joined {moment(user.created_on, 'YYYYMMDD').fromNow()}
      </p>
      <p className="email">
        <i className="fa fa-envelope-o" /> {user.email}
      </p>
      <p className="roles">
        <i className="fa fa-lock" /> {Object.keys(user.roles).map(k => (
          <Label key={`${k}-label`}>{k}</Label>
        ))}
      </p>
      <p>
        <i className="fa fa-key" />&nbsp;
        <span className="text-muted">id:</span>&nbsp;
        <span className="user-id">{user.id}</span>
      </p>
    </Panel>
  </div>
);
UserInfo.propTypes = propTypes;
export default UserInfo;
