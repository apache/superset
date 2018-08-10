/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import React from 'react';
import PropTypes from 'prop-types';
import { Panel, Row, Col, Tabs, Tab, FormControl } from 'react-bootstrap';
import { t } from '@superset-ui/translation';
import URI from 'urijs';
import RecentActivity from '../profile/components/RecentActivity';
import Favorites from '../profile/components/Favorites';
import DashboardTable from './DashboardTable';
import SelectControl from '../explore/components/controls/SelectControl';
import TagsTable from './TagsTable';
import { fetchSuggestions } from '../tags';
import { STANDARD_TAGS } from '../dashboard/util/constants';

const propTypes = {
  user: PropTypes.object.isRequired,
};

export default class Welcome extends React.PureComponent {
  constructor(props) {
    super(props);

    const parsedUrl = new URI(window.location);
    const key = parsedUrl.fragment() || 'tags';
    const searchParams = parsedUrl.search(true);
    const dashboardSearch = searchParams.search || '';
    const tagSearch = searchParams.tags || 'owner:{{ current_user_id() }}';
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
    const parsedUrl = new URI(window.location);
    parsedUrl.search(data => ({ ...data, [key]: value }));
    window.history.pushState({ value }, value, parsedUrl.href());
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
          <Tab eventKey="favorites" title={t('Favorites')}>
            <Panel>
              <Row>
                <Col md={8}><h2>{t('Favorites')}</h2></Col>
              </Row>
              <hr />
              <Favorites user={this.props.user} />
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
        </Tabs>
      </div>
    );
  }
}

Welcome.propTypes = propTypes;
