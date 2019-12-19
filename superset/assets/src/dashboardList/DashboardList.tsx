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
import { SupersetClient } from '@superset-ui/connection';
import { t } from '@superset-ui/translation';
import moment from 'moment';
import PropTypes from 'prop-types';
import React from 'react';
import { Button, Modal, Panel } from 'react-bootstrap';
import ListView from 'src/components/ListView/ListView';
import { FilterTypeMap } from 'src/components/ListView/types';
import { FetchDataConfig } from 'src/components/ListView/types';
import withToasts from 'src/messageToasts/enhancers/withToasts';

import './DashboardList.less';

const PAGE_SIZE = 25;

interface Props {
  addDangerToast: (msg: string) => void;
}

interface State {
  dashboards: any[];
  dashboard_count: number;
  loading: boolean;
  showDeleteModal: boolean;
  deleteCandidate: any;
  filterTypes: FilterTypeMap;
  permissions: string[];
}
class DashboardTable extends React.PureComponent<Props, State> {

  get canEdit() {
    return this.hasPerm('can_edit');
  }

  get canDelete() {
    return this.hasPerm('can_delete');
  }
  public static propTypes = {
    addDangerToast: PropTypes.func.isRequired,
  };

  public state: State = {
    dashboard_count: 0,
    dashboards: [],
    deleteCandidate: {},
    filterTypes: {},
    loading: false,
    permissions: [],
    showDeleteModal: false,
  };

  public columns = [
    {
      Cell: ({
        row: {
          original: { url, dashboard_title },
        },
      }: any) => <a href={url}>{dashboard_title}</a>,
      Header: 'Dashboard',
      accessor: 'dashboard_title',
      filterable: true,
      sortable: true,
    },
    {
      Cell: ({
        row: {
          original: { changed_by_name, changed_by_url },
        },
      }: any) => <a href={changed_by_url}>{changed_by_name}</a>,
      Header: 'Creator',
      accessor: 'changed_by_fk',
      sortable: true,
    },
    {
      Cell: ({
        row: {
          original: { published },
        },
      }: any) => (
          <span className='no-wrap'>{published ? <i className='fa fa-check' /> : ''}</span>
        ),
      Header: 'Published',
      accessor: 'published',
      sortable: true,
    },
    {
      Cell: ({
        row: {
          original: { changed_on },
        },
      }: any) => (
          <span className='no-wrap'>{moment(changed_on).fromNow()}</span>
        ),
      Header: 'Modified',
      accessor: 'changed_on',
      sortable: true,
    },
    {
      Cell: ({ row: { state, original } }: any) => {
        const handleDelete = () => this.handleDashboardDeleteConfirm(original);
        const handleEdit = () => this.handleDashboardEdit(original);
        if (!this.canEdit && !this.canDelete) {
          return null;
        }

        return (
          <span className={`actions ${state && state.hover ? '' : 'invisible'}`}>
            {this.canDelete && (
              <span
                role='button'
                className='action-button'
                onClick={handleDelete}
              >
                <i className='fa fa-trash' />
              </span>
            )}
            {this.canEdit && (
              <span
                role='button'
                className='action-button'
                onClick={handleEdit}
              >
                <i className='fa fa-pencil' />
              </span>
            )}
          </span>
        );
      },
      Header: 'Actions',
      id: 'actions',
    },
  ];

  public initialSort = [{ id: 'changed_on', desc: true }];

  public hasPerm = (perm: string) => {
    if (!this.state.permissions.length) {
      return false;
    }

    return Boolean(this.state.permissions.find((p) => p === perm));
  }

  public handleDashboardEdit = ({ id }: { id: number }) => {
    window.location.assign(`/dashboard/edit/${id}`);
  }

  public handleDashboardDeleteConfirm = (dashboard: any) => {
    this.setState({
      deleteCandidate: dashboard,
      showDeleteModal: true,
    });
  }

  public handleDashboardDelete = () => {
    const { id, title } = this.state.deleteCandidate;
    SupersetClient.delete({
      endpoint: `/api/v1/dashboard/${id}`,
    }).then(
      (resp) => {
        const dashboards = this.state.dashboards.filter((d) => d.id !== id);
        this.setState({
          dashboards,
          deleteCandidate: {},
          showDeleteModal: false,
        });
      },
      (err: any) => {
        this.props.addDangerToast(t(`There was an issue deleting ${title}`));
        this.setState({ showDeleteModal: false, deleteCandidate: {} });
      },
    );
  }

  public toggleModal = () => {
    this.setState({ showDeleteModal: !this.state.showDeleteModal });
  }

  public fetchData = ({
    pageIndex,
    pageSize,
    sortBy,
    filters,
  }: FetchDataConfig) => {
    this.setState({ loading: true });
    const filterExps = Object.keys(filters).map((fk) => ({
      col: fk,
      opr: filters[fk].filterId,
      value: filters[fk].filterValue,
    }));

    const queryParams = JSON.stringify({
      order_column: sortBy[0].id,
      order_direction: sortBy[0].desc ? 'desc' : 'asc',
      page: pageIndex,
      page_size: pageSize,
      ...(filterExps.length ? { filters: filterExps } : {}),
    });

    return SupersetClient.get({
      endpoint: `/api/v1/dashboard/?q=${queryParams}`,
    })
      .then(({ json }) => {
        this.setState({ dashboards: json.result, dashboard_count: json.count });
      })
      .catch(() => {
        this.props.addDangerToast(
          t('An error occurred while fetching Dashboards'),
        );
      })
      .finally(() => this.setState({ loading: false }));
  }

  public componentDidMount() {
    SupersetClient.get({
      endpoint: `/api/v1/dashboard/_info`,
    })
      .then(({ json }) => {
        this.setState({ filterTypes: json.filters, permissions: json.permissions });
      });
  }

  public render() {
    return (
      <div className='container welcome'>
        <Panel>
          <ListView
            className='dashboard-list-view'
            title={'Dashboards'}
            columns={this.columns}
            data={this.state.dashboards}
            count={this.state.dashboard_count}
            pageSize={PAGE_SIZE}
            fetchData={this.fetchData}
            loading={this.state.loading}
            initialSort={this.initialSort}
            filterable={true}
            filterTypes={this.state.filterTypes}
          />
        </Panel>

        <Modal show={this.state.showDeleteModal} onHide={this.toggleModal}>
          <Modal.Header closeButton={true} />
          <Modal.Body>
            Are you sure you want to delete{' '}
            <b>{this.state.deleteCandidate.dashboard_title}</b>?
          </Modal.Body>
          <Modal.Footer>
            <Button onClick={this.toggleModal}>Cancel</Button>
            <Button bsStyle='danger' onClick={this.handleDashboardDelete}>
              OK
            </Button>
          </Modal.Footer>
        </Modal>
      </div>
    );
  }
}

export default withToasts(DashboardTable);
