import React from 'react';
import PropTypes from 'prop-types';
import AceEditor from 'react-ace';
import { Button, Panel } from 'react-bootstrap';
import Select from 'react-virtualized-select';
import MultiSelect from "@kenshooui/react-multi-select";
import TextControl from '../explore/components/controls/TextControl';
import InfoTooltipWithTrigger from '../components/InfoTooltipWithTrigger';
import ModalTrigger from '../components/ModalTrigger';
import visTypes from '../explore/visTypes';
import Fieldset from '../CRUD/Fieldset';
import Field from '../CRUD/Field';
import $ from 'jquery';
import { t } from '../locales';
import 'brace/mode/sql';
import 'brace/mode/json';
import 'brace/mode/html';
import 'brace/mode/markdown';
import 'brace/theme/textmate';

const propTypes = {
  onChange: PropTypes.func,
  code: PropTypes.string,
  language: PropTypes.oneOf(['yaml', 'json']),
  datasources: PropTypes.arrayOf(PropTypes.shape({
    label: PropTypes.string.isRequired,
    value: PropTypes.string.isRequired,
  })).isRequired,
};

const styleSelectWidth = { width: 300 };

const defaultProps = {
  label: null,
  description: null,
  onChange: () => {},
  code: '{}',
};

export default class AddAlertContainer extends React.Component {
  constructor(props) {
    super(props);
    const params = props.code || '{}';
    this.state = {
      params,
      parsedJSON: null,
      isValid: true,
      newTag: '',
      items: [
        { id: 0, label: "completion"},
        { id: 1, label: "latency"},
        { id: 2, label: "syntax"},
        { id: 3, label: "semantic"}
      ],
      selectedItems: []
    };
    this.onChange = this.onChange.bind(this);
    this.handleTagChange = this.handleTagChange.bind(this)
  }

  componentDidMount() {
    this.onChange(this.state.params);
  }

  handleTagChange(selectedItems) {
    this.setState({ selectedItems });
  }

  onChange(value) {
    const params = value;
    let isValid;
    let parsedJSON = {};
    try {
      parsedJSON = JSON.parse(value);
      isValid = true;
    } catch (e) {
      isValid = false;
    }
    this.setState({ parsedJSON, isValid, params });
    if (isValid) {
      this.props.onChange(params);
    } else {
      this.props.onChange('{}');
    }
  }

  handleNameChange(event) {
    console.log(this.state)
    this.setState({name: event.target.value});
  }

  handleTagNameChange(event) {
    this.setState({newTag: event.target.value});
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
      name: this.state.name,
      // tags: this.state.items
    }
    this.sendPostRequest(data)
  }

  addTag() {
    const data = [...this.state.items]
    const index = data[data.length - 1].id + 1
    const newTag = {id: index, label: this.state.newTag}
    data.push(newTag)
    this.setState({
      items: data
    })
  }

  changeDatasource(e) {
    this.setState({
      datasourceValue: e.value,
      datasourceId: e.value.split('__')[0],
      datasourceType: e.value.split('__')[1],
    });
  }

  isBtnDisabled() {
    return !(this.state.datasourceId
      && this.state.name
      && this.state.interval
      && this.state.params
      && this.state.isValid
    );
  }

  isTagBtnDisabled() {
    return !this.state.newTag
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
        alert("ERROR: " + errorMsg);
    });
    return
  };

  render() {
    const { items, selectedItems } = this.state;
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
                <input
                  type="text"
                  style={{
                    "margin-right": 20,
                    "width": 300,
                    "border-radius": 6,
                    "border-style": "solid",
                    "border-color": "#d2d2d2",
                    "border-width": "1"
                  }}
                  value={this.state.value}
                  onChange={this.handleNameChange.bind(this)}
                />
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
              <AceEditor
                mode="json"
                theme="textmate"
                style={{ border: '1px solid #CCC' }}
                minLines={25}
                maxLines={50}
                onChange={this.onChange.bind(this)}
                width="80%"
                height="400px"
                editorProps={{ $blockScrolling: true }}
                enableLiveAutocompletion
                value={this.state.params}
              />
              <p className="text-muted">JSON field</p>
            </div>
            <br />
            <div>
              <p>Tags</p>
              <label style={{ "margin-bottom": 10 }}>
                <input
                  type="text"
                  style={{
                    "margin-right": 20,
                    "width": 300,
                    "border-radius": 6,
                    "border-style": "solid",
                    "border-color": "#d2d2d2",
                    "border-width": "1"
                  }}
                  value={this.state.newTag}
                  onChange={this.handleTagNameChange.bind(this)}
                />
              </label>
              <Button
                bsStyle="primary"
                className="save-modal-selector"
                disabled={this.isTagBtnDisabled()}
                onClick={this.addTag.bind(this)}
                >
                Add tag
              </Button>
              <MultiSelect
                items={items}
                selectedItems={selectedItems}
                onChange={this.handleTagChange}
              />
            </div>
            <br /><br />
            <Button
              bsStyle="primary"
              disabled={this.isBtnDisabled()}
              onClick={this.saveAlert.bind(this)}
            >
              {!this.state.isValid &&
                <InfoTooltipWithTrigger
                  icon="exclamation-triangle"
                  bsStyle="danger"
                  tooltip={t('Invalid JSON')}
                  label="invalid-json"
                />
              }
              {t(' Create new alert')}
            </Button>
            <br /><br />
          </form>
        </Panel>
      </div>
    );
  }
}

AddAlertContainer.propTypes = propTypes;
AddAlertContainer.defaultProps = defaultProps;
