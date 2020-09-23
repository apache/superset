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
import { t, SupersetClient } from '@superset-ui/core';

import ListView from 'src/components/ListView';
import withToasts from '../messageToasts/enhancers/withToasts';
import '../../stylesheets/reactable-pagination.less';

const propTypes = {
  dataEndpoint: PropTypes.string.isRequired,
  mutator: PropTypes.func,
  columns: PropTypes.arrayOf(PropTypes.string),
  addDangerToast: PropTypes.func.isRequired,
  addInfoToast: PropTypes.func.isRequired,
  addSuccessToast: PropTypes.func.isRequired,
  addWarningToast: PropTypes.func.isRequired,
};

class TableLoader extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      isLoading: true,
      data: [],
    };
  }

  sortDataByColumn = (data, sortById, desc, elementSelector = e => e) => {
    const id = data[0].hasOwnProperty(`_${sortById}`)
      ? `_${sortById}`
      : sortById;
    return data.sort((row1, row2) => {
      const rows = desc ? [row2, row1] : [row1, row2];
      let firstVal = rows[0][id];
      let secondVal = rows[1][id];
      if (typeof firstVal === 'object' && typeof secondVal === 'object') {
        firstVal = elementSelector(firstVal);
        secondVal = elementSelector(secondVal);
      }
      if (typeof firstVal === 'string' && typeof secondVal === 'string') {
        return secondVal.localeCompare(firstVal);
      }
      if (typeof firstVal === 'number' && typeof secondVal === 'number') {
        return secondVal - firstVal;
      }
      if (typeof firstVal === 'undefined' || firstVal === null) {
        return 1;
      }
      return -1;
    });
  };

  fetchOrSortData = ({ sortBy }) => {
    const { dataEndpoint, mutator } = this.props;

    if (this.state.data.length > 0 && sortBy.length > 0) {
      const { id, desc } = sortBy[0];
      this.setState(({ data }) => ({
        data: this.sortDataByColumn(data, id, desc, e => e.props.children),
      }));
      return;
    }

    SupersetClient.get({ endpoint: dataEndpoint })
      .then(({ json }) => {
        const data = mutator ? mutator(json) : json;
        this.setState({ data, isLoading: false });
      })
      .catch(() => {
        this.setState({ isLoading: false });
        this.props.addDangerToast(t('An error occurred'));
      });
  };

  render() {
    const {
      addDangerToast,
      addInfoToast,
      addSuccessToast,
      addWarningToast,
      ...tableProps
    } = this.props;

    let { columns = [] } = this.props;
    if (columns.length === 0 && this.state.data.length > 0) {
      columns = Object.keys(this.state.data[0]).filter(col => col[0] !== '_');
    }
    delete tableProps.dataEndpoint;
    delete tableProps.mutator;
    delete tableProps.columns;

    return (
      <ListView
        columns={columns.map(column => ({
          accessor: column,
          Header: column,
        }))}
        data={this.state.data}
        count={this.state.data.length}
        pageSize={50}
        fetchData={this.fetchOrSortData}
        loading={this.state.isLoading}
      />
    );
  }
}

TableLoader.propTypes = propTypes;

export default withToasts(TableLoader);
