import React from 'react';
import $ from 'jquery';
import PropTypes from 'prop-types';
import { BootstrapTable, TableHeaderColumn } from 'react-bootstrap-table';

import ModalTrigger from '../../components/ModalTrigger';
import { t } from '../../locales';

require('react-bootstrap-table/css/react-bootstrap-table.css');

const propTypes = {
  dashboard: PropTypes.object.isRequired,
  triggerNode: PropTypes.node.isRequired,
  userId: PropTypes.string.isRequired,
  addSlicesToDashboard: PropTypes.func,
};

class SliceAdder extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      slices: [],
      slicesLoaded: false,
      selectionMap: {},
    };

    this.options = {
      defaultSortOrder: 'desc',
      defaultSortName: 'modified',
      sizePerPage: 10,
    };

    this.addSlices = this.addSlices.bind(this);
    this.toggleSlice = this.toggleSlice.bind(this);

    this.selectRowProp = {
      mode: 'checkbox',
      clickToSelect: true,
      onSelect: this.toggleSlice,
    };
  }

  componentWillUnmount() {
    if (this.slicesRequest) {
      this.slicesRequest.abort();
    }
  }

  onEnterModal() {
    const uri = `/sliceaddview/api/read?_flt_0_created_by=${this.props.userId}`;
    this.slicesRequest = $.ajax({
      url: uri,
      type: 'GET',
      success: (response) => {
        // Prepare slice data for table
        const slices = response.result.map(slice => ({
          id: slice.id,
          sliceName: slice.slice_name,
          vizType: slice.viz_type,
          datasourceLink: slice.datasource_link,
          modified: slice.modified,
        }));

        this.setState({
          slices,
          selectionMap: {},
          slicesLoaded: true,
        });
      },
      error: (error) => {
        this.errored = true;
        this.setState({
          errorMsg: t('Sorry, there was an error fetching slices to this dashboard: ') +
          this.getAjaxErrorMsg(error),
        });
      },
    });
  }

  getAjaxErrorMsg(error) {
    const respJSON = error.responseJSON;
    return (respJSON && respJSON.message) ? respJSON.message :
      error.responseText;
  }

  addSlices() {
    const adder = this;
    this.props.addSlicesToDashboard(Object.keys(this.state.selectionMap))
      // if successful, page will be reloaded.
      .fail((error) => {
        adder.errored = true;
        adder.setState({
          errorMsg: t('Sorry, there was an error adding slices to this dashboard: ') +
          this.getAjaxErrorMsg(error),
        });
      });
  }

  toggleSlice(slice) {
    const selectionMap = Object.assign({}, this.state.selectionMap);
    selectionMap[slice.id] = !selectionMap[slice.id];
    this.setState({ selectionMap });
  }

  modifiedDateComparator(a, b, order) {
    if (order === 'desc') {
      if (a.changed_on > b.changed_on) {
        return -1;
      } else if (a.changed_on < b.changed_on) {
        return 1;
      }
      return 0;
    }

    if (a.changed_on < b.changed_on) {
      return -1;
    } else if (a.changed_on > b.changed_on) {
      return 1;
    }
    return 0;
  }

  render() {
    const hideLoad = this.state.slicesLoaded || this.errored;
    let enableAddSlice = this.state.selectionMap && Object.keys(this.state.selectionMap);
    if (enableAddSlice) {
      enableAddSlice = enableAddSlice.some(function (key) {
        return this.state.selectionMap[key];
      }, this);
    }
    const modalContent = (
      <div>
        <img
          src="/static/assets/images/loading.gif"
          className={'loading ' + (hideLoad ? 'hidden' : '')}
          alt={hideLoad ? '' : 'loading'}
        />
        <div className={this.errored ? '' : 'hidden'}>
          {this.state.errorMsg}
        </div>
        <div className={this.state.slicesLoaded ? '' : 'hidden'}>
          <BootstrapTable
            ref="table"
            data={this.state.slices}
            selectRow={this.selectRowProp}
            options={this.options}
            hover
            search
            pagination
            condensed
            height="auto"
          >
            <TableHeaderColumn
              dataField="id"
              isKey
              dataSort
              hidden
            />
            <TableHeaderColumn
              dataField="sliceName"
              dataSort
            >
              {t('Name')}
            </TableHeaderColumn>
            <TableHeaderColumn
              dataField="vizType"
              dataSort
            >
              {t('Viz')}
            </TableHeaderColumn>
            <TableHeaderColumn
              dataField="datasourceLink"
              dataSort
              // Will cause react-bootstrap-table to interpret the HTML returned
              dataFormat={datasourceLink => datasourceLink}
            >
              {t('Datasource')}
            </TableHeaderColumn>
            <TableHeaderColumn
              dataField="modified"
              dataSort
              sortFunc={this.modifiedDateComparator}
              // Will cause react-bootstrap-table to interpret the HTML returned
              dataFormat={modified => modified}
            >
              {t('Modified')}
            </TableHeaderColumn>
          </BootstrapTable>
          <button
            type="button"
            className="btn btn-default"
            data-dismiss="modal"
            onClick={this.addSlices}
            disabled={!enableAddSlice}
          >
            {t('Add Slices')}
          </button>
        </div>
      </div>
    );

    return (
      <ModalTrigger
        triggerNode={this.props.triggerNode}
        tooltip={t('Add a new slice to the dashboard')}
        beforeOpen={this.onEnterModal.bind(this)}
        isMenuItem
        modalBody={modalContent}
        bsSize="large"
        setModalAsTriggerChildren
        modalTitle={t('Add Slices to Dashboard')}
      />
    );
  }
}

SliceAdder.propTypes = propTypes;

export default SliceAdder;
