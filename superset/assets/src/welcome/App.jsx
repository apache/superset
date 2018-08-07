import React from 'react';
import PropTypes from 'prop-types';
import { Panel, Row, Col, Tabs, Tab, FormControl } from 'react-bootstrap';
import 'url-polyfill';
import RecentActivity from '../profile/components/RecentActivity';
import Favorites from '../profile/components/Favorites';
import DashboardTable from './DashboardTable';
import SelectControl from '../explore/components/controls/SelectControl';
import TagsTable from './TagsTable';
import { fetchSuggestions } from '../tags';
import { t } from '../locales';
import { STANDARD_TAGS } from '../dashboard/util/constants';

const propTypes = {
  user: PropTypes.object.isRequired,
};

export default class App extends React.PureComponent {
  constructor(props) {
    super(props);
    const parsedUrl = new URL(window.location);
    const key = parsedUrl.hash.substr(1) || 'dashboards';
    const dashboardSearch = parsedUrl.searchParams.get('search') || '';
    const tagSearch = parsedUrl.searchParams.get('tags') || '';
    this.state = {
      key,
      dashboardSearch,
      tagSearch,
      tagSuggestions: STANDARD_TAGS,
    };

    this.handleSelect = this.handleSelect.bind(this);
    this.onDashboardSearchChange = this.onDashboardSearchChange.bind(this);
    this.onTagSearchChange = this.onTagSearchChange.bind(this);
  }
  componentDidMount() {
    fetchSuggestions({ includeTypes: false }, (suggestions) => {
      const tagSuggestions = [
        ...STANDARD_TAGS,
        ...suggestions.map(tag => tag.name),
      ];
      this.setState({ tagSuggestions });
    });
  }
  onDashboardSearchChange(event) {
    const dashboardSearch = event.target.value;
    this.setState({ dashboardSearch }, () => this.updateURL('search', dashboardSearch));
  }
  onTagSearchChange(tags) {
    const tagSearch = tags.join(',');
    this.setState({ tagSearch }, () => this.updateURL('tags', tagSearch));
  }
  updateURL(key, value) {
    const parsedUrl = new URL(window.location);
    parsedUrl.searchParams.set(key, value);
    window.history.pushState({ value }, value, parsedUrl.href);
  }
  handleSelect(key) {
    // store selected tab in URL
    window.history.pushState({ tab: key }, key, `#${key}`);

    this.setState({ key });
  }
  render() {
    return (
      <div className="container welcome">
        <Tabs
          activeKey={this.state.key}
          onSelect={this.handleSelect}
          id="controlled-tab-example"
        >
          <Tab eventKey="dashboards" title={t('Dashboards')}>
            <Panel>
              <Row>
                <Col md={8}><h2>{t('Dashboards')}</h2></Col>
                <Col md={4}>
                  <FormControl
                    type="text"
                    bsSize="sm"
                    style={{ marginTop: '25px' }}
                    placeholder="Search"
                    value={this.state.dashboardSearch}
                    onChange={this.onDashboardSearchChange}
                  />
                </Col>
              </Row>
              <hr />
              <DashboardTable search={this.state.dashboardSearch} />
            </Panel>
          </Tab>
          <Tab eventKey="recent" title={t('Recently Viewed')}>
            <Panel>
              <Row>
                <Col md={8}><h2>{t('Recently Viewed')}</h2></Col>
              </Row>
              <hr />
              <RecentActivity user={this.props.user} />
            </Panel>
          </Tab>
          <Tab eventKey="favorites" title={t('Favorites')}>
            <Panel>
              <Row>
                <Col md={8}><h2>{t('Favorites')}</h2></Col>
              </Row>
              <hr />
              <Favorites user={this.props.user} />
            </Panel>
          </Tab>
          <Tab eventKey="tags" title={t('Tags')}>
            <Panel>
              <Row>
                <Col md={8}><h2>{t('Tags')}</h2></Col>
              </Row>
              <Row>
                <Col md={12}>
                  <SelectControl
                    name="tags"
                    value={this.state.tagSearch.split(',')}
                    multi
                    onChange={this.onTagSearchChange}
                    choices={this.state.tagSuggestions}
                  />
                </Col>
              </Row>
              <hr />
              <TagsTable search={this.state.tagSearch} />
            </Panel>
          </Tab>
        </Tabs>
      </div>
    );
  }
}

App.propTypes = propTypes;
