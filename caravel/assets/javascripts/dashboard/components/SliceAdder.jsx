import $ from 'jquery';
import React, { PropTypes } from 'react';
import update from 'immutability-helper';
import { BootstrapTable, TableHeaderColumn } from 'react-bootstrap-table';
import Modal from './Modal.jsx';
require('react-bootstrap-table/css/react-bootstrap-table.css');

const propTypes = {
  dashboard: PropTypes.object.isRequired,
  caravel: PropTypes.object.isRequired,
};

class SliceAdder extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      slices: [],
    };

    this.addSlices = this.addSlices.bind(this);
    this.toggleSlice = this.toggleSlice.bind(this);
    this.toggleAllSlices = this.toggleAllSlices.bind(this);
    this.slicesLoaded = false;
    this.selectRowProp = {
      mode: 'checkbox',
      clickToSelect: true,
      onSelect: this.toggleSlice,
      onSelectAll: this.toggleAllSlices,
    };
    this.options = {
      defaultSortOrder: 'desc',
      defaultSortName: 'modified',
      sizePerPage: 10,
    };
  }

  componentDidMount() {
    const uri = '/sliceaddview/api/read?_flt_0_created_by=' + this.props.dashboard.curUserId;
    this.slicesRequest = $.ajax({
      url: uri,
      type: 'GET',
      success: function (response) {
        this.slicesLoaded = true;
        // Prepare slice data for table
        const slices = response.result.map(function (slice) {
          return {
            id: slice.data.slice_id,
            sliceName: slice.data.slice_name,
            vizType: slice.viz_type,
            modified: slice.modified,
            data: slice.data,
          };
        });

        this.setState({
          slices,
          selectionMap: {},
        });
      }.bind(this),
      error: function (error) {
        this.errored = true;
        this.setState({
          errorMsg: this.props.dashboard.getAjaxErrorMsg(error),
        });
      }.bind(this),
    });
  }

  componentWillUnmount() {
    this.slicesRequest.abort();
  }

  addSlices() {
    const slices = this.state.slices.filter(function (slice) {
      return this.state.selectionMap[slice.id];
    }, this);
    slices.forEach(function (slice) {
      const sliceObj = this.props.caravel.Slice(slice.data, this.props.dashboard);
      $('#slice_' + slice.data.slice_id).find('a.refresh').click(function () {
        sliceObj.render(true);
      });
      this.props.dashboard.slices.push(sliceObj);
    }, this);

    this.props.dashboard.addSlicesToDashboard(Object.keys(this.state.selectionMap));
  }

  toggleSlice(slice) {
    this.setState({
      selectionMap: update(this.state.selectionMap, {
        [slice.id]: {
          $set: !this.state.selectionMap[slice.id],
        },
      }),
    });
  }

  toggleAllSlices(value) {
    const updatePayload = {};

    this.state.slices.forEach(function (slice) {
      updatePayload[slice.id] = {
        $set: value,
      };
    }, this);

    this.setState({
      selectionMap: update(this.state.selectionMap, updatePayload),
    });
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
    const hideLoad = this.slicesLoaded || this.errored;
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
        <div className={this.slicesLoaded ? '' : 'hidden'}>
          <BootstrapTable
            ref="table"
            data={this.state.slices}
            selectRow={this.selectRowProp}
            options={this.options}
            hover
            search
            pagination
            height="auto"
          >
            <TableHeaderColumn
              dataField="sliceName"
              isKey
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
        </div>
      </div>
    );
    const customButton = (
      <button
        type="button"
        className="btn btn-default"
        data-dismiss="modal"
        onClick={this.addSlices}
        disabled={!enableAddSlice}
      >
        Add Slices
      </button>
    );

    return (
      <Modal
        modalId="add_slice_modal"
        modalContent={modalContent}
        title="Add New Slices"
        customButton={customButton}
      />
    );
  }
}

SliceAdder.propTypes = propTypes;

export default SliceAdder;
