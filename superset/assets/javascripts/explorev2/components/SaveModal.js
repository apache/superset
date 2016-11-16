/* eslint camel-case: 0 */
import React, { PropTypes } from 'react';
const $ = window.$ = require('jquery');
import { Modal, Alert } from 'react-bootstrap';
import Select from 'react-select';
import { connect } from 'react-redux';

const propTypes = {
  can_edit: PropTypes.bool,
  onHide: PropTypes.func.isRequired,
  actions: PropTypes.object.isRequired,
  form_data: PropTypes.object,
  datasource_type: PropTypes.string.isRequired,
  user_id: PropTypes.string.isRequired,
};

class SaveModal extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      save_to_dashboard_id: null,
      dashboards: [],
      alert: null,
    };
  }

  componentDidMount() {
    this.prepSaveDialog();
  }

  setSaveDashboard(opt) {
    this.setState({ save_to_dashboard_id: opt.value });
    $('#add_to_dash_existing').prop('checked', true);
    $('.gotodash').removeAttr('disabled');
  }

  fetchDashboards() {
    const url = '/dashboardmodelviewasync/api/read?_flt_0_owners=' + this.props.user_id;
    $.get(url, function (data) {
      const choices = [];
      for (let i = 0; i < data.pks.length; i++) {
        choices.push({ value: data.pks[i], label: data.result[i].dashboard_title });
      }
      this.setState({ dashboards: choices });
    }.bind(this));
  }

  saveOrOverwrite(gotodash) {
    this.setState({ alert: null });
    const params = {};
    const sliceParams = {};
    params.datasource_id = this.props.form_data.datasource;
    params.datasource_type = this.props.datasource_type;
    params.datasource_name = this.props.form_data.datasource_name;

    const action = $('input[name=rdo_save]:checked').val();
    let sliceName = null;
    sliceParams.action = action;
    if (action === 'saveas') {
      sliceName = $('input[name=new_slice_name]').val();
      if (sliceName === '') {
        this.setState({ alert: 'Please enter a slice name' });
        return;
      }
      sliceParams.slice_name = sliceName;
    } else {
      sliceParams.slice_name = this.props.form_data.slice_name;
    }

    Object.keys(this.props.form_data).forEach((field) => {
      if (this.props.form_data[field] !== null && field !== 'slice_name') {
        params[field] = this.props.form_data[field];
      }
    });

    const addToDash = $('input[name=add_to_dash]:checked').val();
    sliceParams.add_to_dash = addToDash;
    let dashboard = null;
    switch (addToDash) {
      case ('existing'):
        dashboard = this.state.save_to_dashboard_id;
        if (!dashboard) {
          this.setState({ alert: 'Please select a dashboard' });
          return;
        }
        sliceParams.save_to_dashboard_id = dashboard;
        break;
      case ('new'):
        dashboard = $('input[name=new_dashboard_name]').val();
        if (dashboard === '') {
          this.setState({ alert: 'Please enter a dashboard name' });
          return;
        }
        sliceParams.new_dashboard_name = dashboard;
        break;
      default:
        dashboard = null;
    }
    params.V2 = true;
    sliceParams.goto_dash = gotodash;
    const baseUrl = '/superset/explore/' +
      `${this.props.datasource_type}/${this.props.form_data.datasource}/`;
    const saveUrl = `${baseUrl}?${$.param(params, true)}&${$.param(sliceParams, true)}`;
    this.props.actions.saveSlice(saveUrl);
    this.props.onHide();
  }

  prepSaveDialog() {
    const setButtonsState = function () {
      const addToDash = $('input[name=add_to_dash]:checked').val();
      if (addToDash === 'existing' || addToDash === 'new') {
        $('.gotodash').removeAttr('disabled');
      } else {
        $('.gotodash').prop('disabled', true);
      }
    };
    setButtonsState();
    const url = '/dashboardmodelviewasync/api/read?_flt_0_owners=' + this.props.user_id;
    $.get(url, function (data) {
      const choices = [];
      for (let i = 0; i < data.pks.length; i++) {
        choices.push({ value: data.pks[i], label: data.result[i].dashboard_title });
      }
      this.setState({ dashboards: choices });
    }.bind(this));
    $('input[name=add_to_dash]').change(setButtonsState);
    $("input[name='new_dashboard_name']").on('focus', function () {
      $('#add_to_new_dash').prop('checked', true);
      setButtonsState();
    });
    $("input[name='new_slice_name']").on('focus', function () {
      $('#save_as_new').prop('checked', true);
      setButtonsState();
    });
  }

  removeAlert() {
    this.setState({ alert: null });
  }

  render() {
    return (
      <Modal
        show
        onHide={this.props.onHide}
        bsStyle="large"
      >
        <Modal.Header closeButton>
          <Modal.Title>
            Save A Slice
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {this.state.alert &&
            <Alert>
              {this.state.alert}
              <i
                className="fa fa-close pull-right"
                onClick={this.removeAlert.bind(this)}
                style={{ cursor: 'pointer' }}
              />
            </Alert>
          }
          <form>
            <input
              type="radio"
              name="rdo_save"
              value="overwrite"
              disabled={!this.props.can_edit}
            />
            {`Overwrite slice ${this.props.form_data.slice_name}`}
            <br />

            <input
              id="save_as_new"
              type="radio"
              name="rdo_save"
              value="saveas"
            /> Save as &nbsp;
            <input type="text" name="new_slice_name" placeholder="[slice name]" />

            <br />
            <hr />

            <input type="radio" name="add_to_dash" value="false" />
            Do not add to a dashboard
            <br />

            <div
              id="save_to_dashboard_id"
            >
              <input id="add_to_dash_existing" type="radio" name="add_to_dash" value="existing" />
              Add slice to existing dashboard
              <Select
                options={this.state.dashboards}
                onChange={this.setSaveDashboard.bind(this)}
                autoSize={false}
                value={this.state.save_to_dashboard_id}
              />
            </div>
            <br />

            <input type="radio" id="add_to_new_dash" name="add_to_dash" value="new" />
            Add to new dashboard &nbsp;
            <input type="text" name="new_dashboard_name" placeholder="[dashboard name]" />
            <br />
          </form>
        </Modal.Body>

        <Modal.Footer>
          <button
            type="button"
            id="btn_modal_save"
            className="btn pull-left"
            onClick={this.saveOrOverwrite.bind(this)}
          >
            Save
          </button>
          <button
            type="button"
            id="btn_modal_save_goto_dash"
            className="btn btn-primary pull-left gotodash"
            onClick={this.saveOrOverwrite.bind(this, true)}
          >
            Save & go to dashboard
          </button>
        </Modal.Footer>
      </Modal>
    );
  }
}

SaveModal.propTypes = propTypes;

function mapStateToProps(state) {
  return {
    can_edit: state.can_edit,
    form_data: state.viz.form_data,
    datasource_type: state.datasource_type,
    user_id: state.user_id,
  };
}

export { SaveModal };
export default connect(mapStateToProps, () => {})(SaveModal);
