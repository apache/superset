/* eslint camelcase: 0 */
import React, { PropTypes } from 'react';
import { bindActionCreators } from 'redux';
import * as actions from '../actions/exploreActions';
import { connect } from 'react-redux';
import { Panel, Alert } from 'react-bootstrap';
import { sectionsToRender } from '../stores/visTypes';
import ControlPanelSection from './ControlPanelSection';
import FieldSetRow from './FieldSetRow';
import FieldSet from './FieldSet';
import fields from '../stores/fields';

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
    this.removeAlert = this.removeAlert.bind(this);
    this.getFieldData = this.getFieldData.bind(this);
  }
  getFieldData(fieldName) {
    const mapF = fields[fieldName].mapStateToProps;
    if (mapF) {
      return Object.assign({}, this.props.fields[fieldName], mapF(this.props.exploreState));
    }
    return this.props.fields[fieldName];
  }
  sectionsToRender() {
    return sectionsToRender(this.props.form_data.viz_type, this.props.datasource_type);
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
          {this.sectionsToRender().map((section) => (
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
