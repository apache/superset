import React from 'react';
import { Col, Row, Tabs, Tab, Panel } from 'react-bootstrap';
import Favorites from './Favorites';
import UserInfo from './UserInfo';
import Security from './Security';
import RecentActivity from './RecentActivity';
import CreatedContent from './CreatedContent';

const propTypes = {
  user: React.PropTypes.object.isRequired,
};

export default function App(props) {
  return (
    <div className="container app">
      <Row>
        <Col md={3}>
          <UserInfo user={props.user} />
        </Col>
        <Col md={9}>
          <Tabs id="options">
            <Tab eventKey={1} title={<div><i className="fa fa-star" /> Favorites</div>}>
              <Panel><Favorites user={props.user} /></Panel>
            </Tab>
            <Tab
              eventKey={2}
              title={
                <div><i className="fa fa-paint-brush" /> Created Content</div>
              }
            >
              <Panel>
                <CreatedContent user={props.user} />
              </Panel>
            </Tab>
            <Tab eventKey={3} title={<div><i className="fa fa-list" /> Recent Activity</div>}>
              <Panel>
                <RecentActivity user={props.user} />
              </Panel>
            </Tab>
            <Tab eventKey={4} title={<div><i className="fa fa-lock" /> Security & Access</div>}>
              <Panel>
                <Security user={props.user} />
              </Panel>
            </Tab>
          </Tabs>
        </Col>
      </Row>
    </div>
  );
}
App.propTypes = propTypes;
