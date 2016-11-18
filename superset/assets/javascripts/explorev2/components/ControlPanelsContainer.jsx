/* eslint camelcase: 0 */
import React, { PropTypes } from 'react';
import { bindActionCreators } from 'redux';
import * as actions from '../actions/exploreActions';
import { connect } from 'react-redux';
import { Panel, Alert } from 'react-bootstrap';
import { visTypes, commonControlPanelSections } from '../stores/store';
import ControlPanelSection from './ControlPanelSection';
import FieldSetRow from './FieldSetRow';

const propTypes = {
  datasource_type: PropTypes.string.isRequired,
  actions: PropTypes.object.isRequired,
  fields: PropTypes.object.isRequired,
  isDatasourceMetaLoading: PropTypes.bool.isRequired,
  form_data: PropTypes.object.isRequired,
  y_axis_zero: PropTypes.any,
  alert: PropTypes.string,
};

class ControlPanelsContainer extends React.Component {
  componentWillMount() {
    const datasource_id = this.props.form_data.datasource;
    const datasource_type = this.props.datasource_type;
    if (datasource_id) {
      this.props.actions.fetchFieldOptions(datasource_id, datasource_type);
    }
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.form_data.datasource !== this.props.form_data.datasource) {
      if (nextProps.form_data.datasource) {
        this.props.actions.fetchFieldOptions(
          nextProps.form_data.datasource, nextProps.datasource_type);
      }
    }
  }

  onChange(name, value, label) {
    this.props.actions.setFieldValue(name, value, label);
  }

  sectionsToRender() {
    const viz = visTypes[this.props.form_data.viz_type];
    const timeSection = this.props.datasource_type === 'table' ?
      commonControlPanelSections.sqlaTimeSeries : commonControlPanelSections.druidTimeSeries;
    const { datasourceAndVizType, sqlClause } = commonControlPanelSections;
    const sectionsToRender = [datasourceAndVizType].concat(
      viz.controlPanelSections, timeSection, sqlClause);
    return sectionsToRender;
  }

  fieldOverrides() {
    const viz = visTypes[this.props.form_data.viz_type];
    return viz.fieldOverrides;
  }
  removeAlert() {
    this.props.actions.removeControlPanelAlert();
  }

  render() {
    return (
      <Panel>
        {this.props.alert &&
          <Alert bsStyle="warning">
            {this.props.alert}
            <i
              className="fa fa-close pull-right"
              onClick={this.removeAlert.bind(this)}
              style={{ cursor: 'pointer' }}
            />
          </Alert>
        }
        {!this.props.isDatasourceMetaLoading &&
          <div className="scrollbar-container">
            <div className="scrollbar-content">
              {this.sectionsToRender().map((section) => (
                <ControlPanelSection
                  key={section.label}
                  label={section.label}
                  tooltip={section.description}
                >
                  {section.fieldSetRows.map((fieldSets, i) => (
                    <FieldSetRow
                      key={`${section.label}-fieldSetRow-${i}`}
                      fieldSets={fieldSets}
                      fieldOverrides={this.fieldOverrides()}
                      onChange={this.onChange.bind(this)}
                      fields={this.props.fields}
                      form_data={this.props.form_data}
                    />
                  ))}
                </ControlPanelSection>
              ))}
              {/* TODO: add filters section */}
            </div>
          </div>
        }
      </Panel>
    );
  }
}

ControlPanelsContainer.propTypes = propTypes;

function mapStateToProps(state) {
  return {
    alert: state.controlPanelAlert,
    isDatasourceMetaLoading: state.isDatasourceMetaLoading,
    fields: state.fields,
  };
}

function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(actions, dispatch),
  };
}

export { ControlPanelsContainer };

export default connect(mapStateToProps, mapDispatchToProps)(ControlPanelsContainer);
