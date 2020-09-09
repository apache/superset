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
import { Table, Tr, Td } from 'reactable-arc';
import { t, SupersetClient } from '@superset-ui/core';

import withToasts from '../messageToasts/enhancers/withToasts';
import Loading from '../components/Loading';
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

  UNSAFE_componentWillMount() {
    const { dataEndpoint, mutator } = this.props;

    SupersetClient.get({ endpoint: dataEndpoint })
      .then(({ json }) => {
        const data = mutator ? mutator(json) : json;
        this.setState({ data, isLoading: false });
      })
      .catch(() => {
        this.setState({ isLoading: false });
        this.props.addDangerToast(t('An error occurred'));
      });
  }

  render() {
    if (this.state.isLoading) {
      return <Loading />;
    }

    const {
      addDangerToast,
      addInfoToast,
      addSuccessToast,
      addWarningToast,
      ...tableProps
    } = this.props;

    let { columns } = this.props;
    if (!columns && this.state.data.length > 0) {
      columns = Object.keys(this.state.data[0]).filter(col => col[0] !== '_');
    }
    delete tableProps.dataEndpoint;
    delete tableProps.mutator;
    delete tableProps.columns;

    return (
      <Table
        {...tableProps}
        className="table"
        itemsPerPage={50}
        style={{ textTransform: 'capitalize' }}
      >
        {this.state.data.map((row, i) => (
          <Tr key={i}>
            {columns.map(col => {
              if (row.hasOwnProperty(`_${col}`)) {
                return (
                  <Td key={col} column={col} value={row[`_${col}`]}>
                    {row[col]}
                  </Td>
                );
              }
              return (
                <Td key={col} column={col}>
                  {row[col]}
                </Td>
              );
            })}
          </Tr>
        ))}
      </Table>
    );
  }
}

TableLoader.propTypes = propTypes;

export default withToasts(TableLoader);
