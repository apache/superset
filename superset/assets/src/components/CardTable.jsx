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
import { Button, ButtonGroup, FormControl } from 'react-bootstrap';
import StackGrid from 'react-stack-grid';
import { t } from '@superset-ui/translation';

import Loading from '../components/Loading';
import withToasts from '../messageToasts/enhancers/withToasts';
import './CardTable.css';

const propTypes = {
  renderTable: PropTypes.func.isRequired,
  renderCards: PropTypes.func.isRequired,
  cardWidth: PropTypes.number,
  onSearchChange: PropTypes.func.isRequired,
  title: PropTypes.string.isRequired,
  addDangerToast: PropTypes.func.isRequired,
  items: PropTypes.array,
  loading: PropTypes.bool.isRequired,
  showCardCount: PropTypes.number,
  emptyMessage: PropTypes.node,
};

const defaultProps = {
  cardWidth: 250,
  emptyMessage: t('No data'),
};

class CardTable extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      search: '',
      showTable: false,
    };
    this.onSearchChange = this.onSearchChange.bind(this);
  }
  onSearchChange(event) {
    const search = event.target.value;
    this.setState({ search });
    this.props.onSearchChange(search);
  }
  renderCards() {
    return (
      <StackGrid
        columnWidth={this.props.cardWidth}
        gutterWidth={15}
        gutterHeight={15}
        duration={0}
      >
        {this.props.renderCards()}
      </StackGrid>);
  }
  renderList() {
    if (this.state.showTable) {
      return this.props.renderTable(this.props.items);
    }
    return this.renderCards();
  }
  render() {
    const { showTable } = this.state;
    const { loading, items, emptyMessage } = this.props;
    if (loading) {
      return <Loading />;
    }
    if (items && items.length === 0) {
      return emptyMessage;
    }
    return (
      <div className="CardTable">
        <div className="clearfix">
          <div className="float-left">
            <h3>{this.props.title}</h3>
          </div>
          <div className="controls-right float-right m-l-5">
            <ButtonGroup className="card-table-toggle">
              <Button
                bsSize="sm"
                className={!showTable ? 'active' : ''}
                onClick={() => this.setState({ showTable: false })}
              >
                <i className="fa fa-th fa-lg pull-right text-primary" />&nbsp;
              </Button>
              <Button
                bsSize="sm"
                className={showTable ? 'active' : ''}
                onClick={() => this.setState({ showTable: true })}
              >
                <i className="fa fa-table fa-lg pull-right text-primary" />&nbsp;
              </Button>
            </ButtonGroup>
          </div>
          <div className="float-right">
            <FormControl
              className="input-search"
              type="text"
              bsSize="sm"
              placeholder="Search"
              value={this.state.search}
              onChange={this.onSearchChange}
            />
          </div>
        </div>
        <hr />
        {this.renderList()}
      </div>);
  }
}
CardTable.propTypes = propTypes;
export default withToasts(CardTable);
