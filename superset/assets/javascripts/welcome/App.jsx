import React from 'react';
import { Panel, Row, Col, FormControl } from 'react-bootstrap';

import DashboardTable from './DashboardTable';

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
        <Panel>
          <Row>
            <Col md={8}><h2>Dashboards</h2></Col>
            <Col md={4}>
              <FormControl
                type="text"
                bsSize="sm"
                style={{ marginTop: '25px' }}
                placeholder="Search"
                value={this.state.search}
                onChange={this.onSearchChange}
              />
            </Col>
          </Row>
          <hr />
          <DashboardTable search={this.state.search} />
        </Panel>
      </div>
    );
  }
}
