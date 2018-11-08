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
        { id: 0, label: "area:recipe analytics"},
        { id: 1, label: "area:data quality"},
        { id: 2, label: "category:completeness"},
        { id: 3, label: "category:latency"},
        { id: 4, label: "validity:syntax"},
        { id: 5, label: "validity:semantic"},
        { id: 6, label: "stage:nudge delivery"},
        { id: 7, label: "stage:user engagement"},
        { id: 8, label: "stage:recipe predictions"}
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
      tags: this.state.selectedItems.map((tag) => tag.label).join(','),
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
                  placeholder="Alert name"
                  style={{
                    marginRight: 20,
                    width: 300,
                    height: 30,
                    borderRadius: 3,
                    borderStyle: "solid",
                    borderColor: "#d2d2d2",
                    borderWidth: "1",
                    padding: 10
                  }}
                  value={this.state.value}
                  onChange={this.handleNameChange.bind(this)}
                />
              </label>
            </div>
            <hr />
            <div>
              <p>{t('Choose an analytic query')}</p>
              <div style={styleSelectWidth}>
                <Select
                  clearable={false}
                  style={styleSelectWidth}
                  name="select-datasource"
                  onChange={this.changeDatasource.bind(this)}
                  options={this.props.datasources}
                  placeholder='Queries'
                  value={this.state.datasourceValue}
                  width={200}
                />
              </div>
              <p className="text-muted">
                {t(
                  'If the query your are looking for is not ' +
                  'available in the list, ' +
                  'follow the instructions on the how to add it on the ')}
                <a href="http://superset.apache.org/tutorial.html">{t('Superset tutorial.')}</a>
              </p>
            </div>
            <hr />
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
            <hr />
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
                height="250px"
                editorProps={{ $blockScrolling: true }}
                enableLiveAutocompletion
                value={this.state.params}
              />
              <p className="text-muted">JSON field</p>
            </div>
            <hr />
            <div>
              <p>Tags</p>
              <label style={{ marginBottom: 10 }}>
                <input
                  type="text"
                  placeholder="New tag"
                  style={{
                    marginRight: 20,
                    width: 300,
                    height: 30,
                    borderRadius: 4,
                    borderStyle: "solid",
                    borderColor: "#d2d2d2",
                    borderWidth: "1",
                    padding: 10
                  }}
                  value={this.state.newTag}
                  onChange={this.handleTagNameChange.bind(this)}
                />
              </label>
              <Button
                bsStyle="primary"
                style={{ padding: 4 }}
                className="save-modal-selector"
                disabled={this.isTagBtnDisabled()}
                onClick={this.addTag.bind(this)}
                >
                Add tag
              </Button>
            </div>
            <div style={{ width: "80%" }}>
              <MultiSelect
                items={items}
                selectedItems={selectedItems}
                onChange={this.handleTagChange}
                showSearch={false}
                height={250}
                selectAllHeight={45}
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
