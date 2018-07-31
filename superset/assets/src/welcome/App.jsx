import React from 'react';
import PropTypes from 'prop-types';
import { Panel, Row, Col, Tabs, Tab, FormControl } from 'react-bootstrap';
import 'url-polyfill';
import RecentActivity from '../profile/components/RecentActivity';
import Favorites from '../profile/components/Favorites';
import DashboardTable from './DashboardTable';
import Tags from './Tags';
import { t } from '../locales';

const propTypes = {
  user: PropTypes.object.isRequired,
};

export default class App extends React.PureComponent {
  constructor(props) {
    super(props);
    const parsedUrl = new URL(window.location);
    const key = parsedUrl.hash.substr(1) || 'dashboards';
    const search = parsedUrl.searchParams.get('q') || '';
    this.state = { search, key };

    this.onSearchChange = this.onSearchChange.bind(this);
    this.handleSelect = this.handleSelect.bind(this);
  }
  onSearchChange(event) {
    const search = event.target.value;

    // update URL with search term
    const parsedUrl = new URL(window.location);
    parsedUrl.searchParams.set('q', search);
    window.history.pushState({ search }, search, parsedUrl.href);

    this.setState({ search: event.target.value });
  }
  handleSelect(key) {
    // store selected tab in URL
    window.history.pushState({ tab: key }, key, `#${key}`);

    this.setState({ key });
  }
  render() {
    const searchInput = (
      <FormControl
        type="text"
        bsSize="sm"
        style={{ marginTop: '25px' }}
        placeholder="Search"
        value={this.state.search}
        onChange={this.onSearchChange}
      />
    );
    return (
      <div className="container welcome">
        <Tabs
          activeKey={this.state.key}
          onSelect={this.handleSelect}
          id="controlled-tab-example"
        >
          <Tab eventKey={'dashboards'} title={t('Dashboards')}>
            <Panel>
              <Row>
                <Col md={8}><h2>{t('Dashboards')}</h2></Col>
                <Col md={4}>{searchInput}</Col>
              </Row>
              <hr />
              <DashboardTable search={this.state.search} />
            </Panel>
          </Tab>
          <Tab eventKey={'recent'} title={t('Recently Viewed')}>
            <Panel>
              <Row>
                <Col md={8}><h2>{t('Recently Viewed')}</h2></Col>
              </Row>
              <hr />
              <RecentActivity user={this.props.user} />
            </Panel>
          </Tab>
          <Tab eventKey={'favorites'} title={t('Favorites')}>
            <Panel>
              <Row>
                <Col md={8}><h2>{t('Favorites')}</h2></Col>
              </Row>
              <hr />
              <Favorites user={this.props.user} />
            </Panel>
          </Tab>
          <Tab eventKey={'tags'} title={t('Tags')}>
            <Panel>
              <Row>
                <Col md={8}><h2>{t('Tags')}</h2></Col>
                <Col md={4}>{searchInput}</Col>
              </Row>
              <hr />
              <Tags search={this.state.search} />
            </Panel>
          </Tab>
        </Tabs>
      </div>
    );
  }
}

App.propTypes = propTypes;
