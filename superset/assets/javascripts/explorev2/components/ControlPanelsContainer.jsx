/* eslint camelcase: 0 */
import React, { PropTypes } from 'react';
import { bindActionCreators } from 'redux';
import * as actions from '../actions/exploreActions';
import { connect } from 'react-redux';
import { Panel, Alert } from 'react-bootstrap';
import visTypes, { sectionsToRender } from '../stores/visTypes';
import ControlPanelSection from './ControlPanelSection';
import FieldSetRow from './FieldSetRow';
import FieldSet from './FieldSet';

const propTypes = {
  datasource_type: PropTypes.string.isRequired,
  actions: PropTypes.object.isRequired,
  fields: PropTypes.object.isRequired,
  isDatasourceMetaLoading: PropTypes.bool.isRequired,
  form_data: PropTypes.object.isRequired,
  y_axis_zero: PropTypes.any,
  alert: PropTypes.string,
  exploreState: PropTypes.object.isRequired,
};

class ControlPanelsContainer extends React.Component {
  constructor(props) {
    super(props);
    this.fieldOverrides = this.fieldOverrides.bind(this);
    this.getFieldData = this.getFieldData.bind(this);
    this.removeAlert = this.removeAlert.bind(this);
  }
  componentWillMount() {
    const datasource_id = this.props.form_data.datasource;
    const datasource_type = this.props.datasource_type;
    if (datasource_id) {
      this.props.actions.fetchDatasourceMetadata(datasource_id, datasource_type);
    }
  }
  componentWillReceiveProps(nextProps) {
    if (nextProps.form_data.datasource !== this.props.form_data.datasource) {
      if (nextProps.form_data.datasource) {
        this.props.actions.fetchDatasourceMetadata(
          nextProps.form_data.datasource, nextProps.datasource_type);
      }
    }
  }
  getFieldData(fs) {
    const fieldOverrides = this.fieldOverrides();
    let fieldData = this.props.fields[fs] || {};
    if (fieldOverrides.hasOwnProperty(fs)) {
      const overrideData = fieldOverrides[fs];
      fieldData = Object.assign({}, fieldData, overrideData);
    }
    if (fieldData.mapStateToProps) {
      Object.assign(fieldData, fieldData.mapStateToProps(this.props.exploreState));
    }
    return fieldData;
  }
  sectionsToRender() {
    return sectionsToRender(this.props.form_data.viz_type, this.props.datasource_type);
  }
  fieldOverrides() {
    const viz = visTypes[this.props.form_data.viz_type];
    return viz.fieldOverrides || {};
  }
  removeAlert() {
    this.props.actions.removeControlPanelAlert();
  }
  render() {
    return (
      <div className="scrollbar-container">
        <Panel className="scrollbar-content">
          {this.props.alert &&
            <Alert bsStyle="warning">
              {this.props.alert}
              <i
                className="fa fa-close pull-right"
                onClick={this.removeAlert}
                style={{ cursor: 'pointer' }}
              />
            </Alert>
          }
          {!this.props.isDatasourceMetaLoading && this.sectionsToRender().map((section) => (
            <ControlPanelSection
              key={section.label}
              label={section.label}
              tooltip={section.description}
            >
              {section.fieldSetRows.map((fieldSets, i) => (
                <FieldSetRow
                  key={`fieldsetrow-${i}`}
                  fields={fieldSets.map(fieldName => (
                    <FieldSet
                      name={fieldName}
                      key={`field-${fieldName}`}
                      value={this.props.form_data[fieldName]}
                      validationErrors={this.props.fields[fieldName].validationErrors}
                      actions={this.props.actions}
                      prefix={section.prefix}
                      {...this.getFieldData(fieldName)}
                    />
                  ))}
                />
              ))}
            </ControlPanelSection>
          ))}
        </Panel>
      </div>
    );
  }
}

ControlPanelsContainer.propTypes = propTypes;

function mapStateToProps(state) {
  return {
    alert: state.controlPanelAlert,
    isDatasourceMetaLoading: state.isDatasourceMetaLoading,
    fields: state.fields,
    exploreState: state,
  };
}

function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(actions, dispatch),
  };
}

export { ControlPanelsContainer };

export default connect(mapStateToProps, mapDispatchToProps)(ControlPanelsContainer);
