import React from 'react';
import { Badge, Label, Navbar } from 'react-bootstrap';
import $ from 'jquery';

import './Footer.css';
import UserImage from '../../components/UserImage';
import TooltipWrapper from '../../components/TooltipWrapper';


const propTypes = {
  dashboard: React.PropTypes.object,
};
const defaultProps = {
};

const PROFILE_IMG_SIZE = '32';
const MAX_VIEWERS = 30;

class Footer extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      totalViews: '?',
      userCount: '?',
      viewers: [],
    };
  }
  componentWillMount() {
    $.ajax({
      url: `/superset/dashboard/${this.props.dashboard.id}/stats/`,
      success: (resp) => {
        const viewers = resp;
        let totalViews = 0;
        resp.forEach((d) => {
          totalViews += d.views;
        });
        const userCount = resp.length;
        this.setState({ totalViews, userCount, viewers });
      },
      error() {
      },
    });
  }
  renderViewers() {
    const viewers = this.state.viewers.slice(0, MAX_VIEWERS);
    let extra;
    if (this.state.viewers.length > MAX_VIEWERS) {
      extra = (
        <Label className="m-l-3">
          <i className="fa fa-plus-circle" /> {''}
          {this.state.viewers.length - MAX_VIEWERS} more
        </Label>);
    }
    return (
      <span>
        {viewers.map(user => this.renderUserIcon(user))}
        {extra}
      </span>);
  }
  renderUserIcon(user) {
    return (
      <UserImage
        user={user}
        tooltip={
          <div>
            <div>{user.first_name} {user.last_name}</div>
            {user.views &&
              <div><b>{user.views}</b> views</div>
            }
          </div>
        }
        width={PROFILE_IMG_SIZE}
        height={PROFILE_IMG_SIZE}
      />
    );
  }
  render() {
    const dashboard = this.props.dashboard;
    return (
      <Navbar fluid inverse className="bottom">
        <Navbar.Collapse>
          <span>
            <Navbar.Text>
              <TooltipWrapper label="owners" tooltip="Owner(s)">
                <i className="fa fa-wrench" />
              </TooltipWrapper>
            </Navbar.Text>
            <span
              className="profile-images pull-left"
              style={{ marginRight: 50 }}
            >
              {dashboard.owners.map(user => this.renderUserIcon(user))}
            </span>
          </span>
          <span>
            <Navbar.Text>
              <TooltipWrapper label="viewers" tooltip="Viewers">
                <i className="fa fa-users" />
              </TooltipWrapper>
            </Navbar.Text>
            <span className="profile-images pull-left">
              {this.renderViewers()}
            </span>
          </span>
          <Navbar.Text pullRight>
            <TooltipWrapper label="user-views" tooltip="Number of views">
              <span>
                <i className="fa fa-eye" /> <Badge>{this.state.totalViews}</Badge>
              </span>
            </TooltipWrapper>
          </Navbar.Text>
          <Navbar.Text pullRight>
            <TooltipWrapper label="user-count" tooltip="Number of viewers">
              <span>
                <i className="fa fa-user" /> <Badge>{this.state.userCount}</Badge>
              </span>
            </TooltipWrapper>
          </Navbar.Text>
        </Navbar.Collapse>
      </Navbar>
    );
  }
}
Footer.propTypes = propTypes;
Footer.defaultProps = defaultProps;

export default Footer;
