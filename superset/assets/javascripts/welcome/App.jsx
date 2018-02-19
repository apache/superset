import React from 'react';
import PropTypes from 'prop-types';
import { Panel, Row, Col, Tabs, Tab } from 'react-bootstrap';
import RecentActivity from '../profile/components/RecentActivity';
import Favorites from '../profile/components/Favorites';
import DashboardTable from './DashboardTable';

const propTypes = {
  user: PropTypes.object.isRequired,
};

export default class App extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      search: '',
    };
    this.onSearchChange = this.onSearchChange.bind(this);
  }
  onSearchChange(event) {
    this.setState({ search: event.target.value });
  }
  render() {
    return (
      <div className="container welcome">
        <Tabs defaultActiveKey={1} id="uncontrolled-tab-example">
          <Tab eventKey={1} title="Recently Viewed">
            <Panel>
              <Row>
                <Col md={8}><h2>Recent Viewed</h2></Col>
              </Row>
              <hr />
              <RecentActivity user={this.props.user} />
            </Panel>
          </Tab>
          <Tab eventKey={2} title="Favorites">
            <Panel>
              <Row>
                <Col md={8}><h2>Favorites</h2></Col>
              </Row>
              <hr />
              <Favorites user={this.props.user} />
            </Panel>
          </Tab>
          <Tab eventKey={3} title="Dashboards">
            <Panel>
              <Row>
                <Col md={8}><h2>Dashboards</h2></Col>
              </Row>
              <hr />
              <DashboardTable search={this.state.search} />
            </Panel>
          </Tab>
          <Tab eventKey={4} title="Charts" disabled>
            <Panel>
              <Row>
                <Col md={8}><h2>Datasources</h2></Col>
              </Row>
              <hr />
              {/* <ChartsTable search={this.state.search} /> */}
            </Panel>
          </Tab>
          <Tab eventKey={5} title="Datasources" disabled>
            <Panel>
              <Row>
                <Col md={8}><h2>Datasources</h2></Col>
              </Row>
              <hr />
              {/* <DatasrouceTable search={this.state.search} /> */}
            </Panel>
          </Tab>
          <Tab eventKey={6} title="Queries" disabled>
            <Panel>
              <Row>
                <Col md={8}><h2>Queries</h2></Col>
              </Row>
              <hr />
              {/* <QueriesTable search={this.state.search} /> */}
            </Panel>
          </Tab>
        </Tabs>
      </div>
    );
  }
}

App.propTypes = propTypes;
