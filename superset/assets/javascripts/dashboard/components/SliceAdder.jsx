import React from 'react';
import $ from 'jquery';
import PropTypes from 'prop-types';
import { BootstrapTable, TableHeaderColumn } from 'react-bootstrap-table';

import ModalTrigger from '../../components/ModalTrigger';

require('react-bootstrap-table/css/react-bootstrap-table.css');

const propTypes = {
  dashboard: PropTypes.object.isRequired,
  triggerNode: PropTypes.node.isRequired,
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
    this.slicesRequest.abort();
  }

  onEnterModal() {
    const uri = '/sliceaddview/api/read?_flt_0_created_by=' + this.props.dashboard.curUserId;
    this.slicesRequest = $.ajax({
      url: uri,
      type: 'GET',
      success: (response) => {
        // Prepare slice data for table
        const slices = response.result.map(slice => ({
          id: slice.id,
          sliceName: slice.slice_name,
          vizType: slice.viz_type,
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
          errorMsg: this.props.dashboard.getAjaxErrorMsg(error),
        });
      },
    });
  }

  addSlices() {
    this.props.dashboard.addSlicesToDashboard(Object.keys(this.state.selectionMap));
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
              Name
            </TableHeaderColumn>
            <TableHeaderColumn
              dataField="vizType"
              dataSort
            >
              Viz
            </TableHeaderColumn>
            <TableHeaderColumn
              dataField="modified"
              dataSort
              sortFunc={this.modifiedDateComparator}
              // Will cause react-bootstrap-table to interpret the HTML returned
              dataFormat={modified => modified}
            >
              Modified
            </TableHeaderColumn>
          </BootstrapTable>
          <button
            type="button"
            className="btn btn-default"
            data-dismiss="modal"
            onClick={this.addSlices}
            disabled={!enableAddSlice}
          >
            Add Slices
          </button>
        </div>
      </div>
    );

    return (
      <ModalTrigger
        triggerNode={this.props.triggerNode}
        tooltip="Add a new slice to the dashboard"
        beforeOpen={this.onEnterModal.bind(this)}
        isButton
        modalBody={modalContent}
        bsSize="large"
        modalTitle="Add Slices to Dashboard"
      />
    );
  }
}

SliceAdder.propTypes = propTypes;

export default SliceAdder;
