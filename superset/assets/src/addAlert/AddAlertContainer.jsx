import React from 'react';
import PropTypes from 'prop-types';
import { Button, Panel } from 'react-bootstrap';
import Select from 'react-virtualized-select';
import TextControl from '../explore/components/controls/TextControl';
import visTypes from '../explore/visTypes';
import Fieldset from '../CRUD/Fieldset';
import Field from '../CRUD/Field';
import $ from 'jquery';

import { t } from '../locales';

const propTypes = {
  datasources: PropTypes.arrayOf(PropTypes.shape({
    label: PropTypes.string.isRequired,
    value: PropTypes.string.isRequired,
  })).isRequired,
};

const styleSelectWidth = { width: 300 };

export default class AddAlertContainer extends React.PureComponent {
  constructor(props) {
    super(props);
    const visTypeKeys = Object.keys(visTypes);
    this.vizTypeOptions = visTypeKeys.map(vt => ({ label: visTypes[vt].label, value: vt }));
    this.state = {
      name: '',
    };
  }

  handleNameChange(event) {
    this.setState({name: event.target.value});
  }

  handleParamChange(event) {
    this.setState({params: event.target.value});
  }

  changeInterval(event) {
    this.setState({
      interval: event.value,
    });
  }

  saveAlert() {
    const data = {
      table_id: this.state.datasourceId,
      params: this.state.params,
      interval: this.state.interval,
      name: this.state.name
    }
    this.sendPostRequest(data)
  }

  changeDatasource(e) {
    this.setState({
      datasourceValue: e.value,
      datasourceId: e.value.split('__')[0],
      datasourceType: e.value.split('__')[1],
    });
  }

  isBtnDisabled() {
    return !(this.state.datasourceId && this.state.name && this.state.interval && this.state.params);
  }

  sendPostRequest(data) {
    const csrf_token = (document.getElementById('csrf_token') || {}).value;

    $.ajaxSetup({
      beforeSend: function(xhr, settings) {
        if (!/^(GET|HEAD|OPTIONS|TRACE)$/i.test(settings.type) && !this.crossDomain) {
          xhr.setRequestHeader("X-CSRFToken", csrf_token);
        }
      }
    });

    $.ajax({
      method: "POST",
      url: "/alert/create",
      data: JSON.stringify(data),
      dataType: 'json',
      contentType: "application/json; charset=utf-8"
    }).done(data => {
        window.location.href = '/alert/list/';
    }).fail(error => {
        const respJSON = error.responseJSON;
        let errorMsg = error.responseText;
        if (respJSON && respJSON.message) {
            errorMsg = respJSON.message;
        }
        alert.log("ERROR: " + errorMsg);
    });
    return
  };

  render() {
    const intervalOptions = [
      {value: 'minute', label: 'minute'},
      {value: 'hour', label: 'hour'},
      {value: 'day', label: 'day'},
    ]
    return (
      <div className="container">
        <Panel header={<h3>{t('Create a new alert')}</h3>}>
          <form>
            <div>
              <p>Name</p>
              <label>
                <input type="text" value={this.state.value} onChange={this.handleNameChange.bind(this)} />
              </label>
            </div>
            <br />
            <div>
              <p>{t('Choose a table')}</p>
              <div style={styleSelectWidth}>
                <Select
                  clearable={false}
                  style={styleSelectWidth}
                  name="select-datasource"
                  onChange={this.changeDatasource.bind(this)}
                  options={this.props.datasources}
                  placeholder='Tables'
                  value={this.state.datasourceValue}
                  width={200}
                />
              </div>
              <p className="text-muted">
                {t(
                  'If the datasource your are looking for is not ' +
                  'available in the list, ' +
                  'follow the instructions on the how to add it on the ')}
                <a href="http://superset.apache.org/tutorial.html">{t('Superset tutorial')}</a>
              </p>
            </div>
            <br />
            <div>
              <p>Choose a time interval</p>
              <div style={styleSelectWidth}>
                <Select
                  clearable={false}
                  style={styleSelectWidth}
                  name="select-interval"
                  onChange={this.changeInterval.bind(this)}
                  options={intervalOptions}
                  placeholder='Intervals'
                  value={this.state.interval}
                  width={200}
                />
              </div>
            </div>
            <br />
            <div>
              <p>Params</p>
              <label>
                <textarea type="text" value={this.state.params} onChange={this.handleParamChange.bind(this)} />
              </label>
              <p className="text-muted">JSON field</p>
            </div>
            <br />
            <Button
              bsStyle="primary"
              disabled={this.isBtnDisabled()}
              onClick={this.saveAlert.bind(this)}
            >
              {t('Create new alert')}
            </Button>
            <br /><br />
          </form>
        </Panel>
      </div>
    );
  }
}

AddAlertContainer.propTypes = propTypes;
