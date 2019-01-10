import React from 'react';
import PropTypes from 'prop-types';
import { Col, Row, Tabs, Tab, Panel } from 'react-bootstrap';
import Favorites from './Favorites';
import UserInfo from './UserInfo';
import Security from './Security';
import RecentActivity from './RecentActivity';
import CreatedContent from './CreatedContent';
import { t } from '../../locales';

const propTypes = {
  user: PropTypes.object.isRequired,
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
            <Tab eventKey={1} title={<div><i className="fa fa-star" /> {t('Favorites')}</div>}>
              <Panel><Favorites user={props.user} /></Panel>
            </Tab>
            <Tab
              eventKey={2}
              title={
                <div><i className="fa fa-paint-brush" /> {t('Created Content')}</div>
              }
            >
              <Panel>
                <CreatedContent user={props.user} />
              </Panel>
            </Tab>
            <Tab eventKey={3} title={<div><i className="fa fa-list" /> {t('Recent Activity')}</div>}>
              <Panel>
                <RecentActivity user={props.user} />
              </Panel>
            </Tab>
            <Tab eventKey={4} title={<div><i className="fa fa-lock" /> {t('Security & Access')}</div>}>
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
