/* eslint camelcase: 0 */
import React, { PropTypes } from 'react';
import { bindActionCreators } from 'redux';
import * as actions from '../actions/exploreActions';
import { connect } from 'react-redux';
import { Panel, Alert } from 'react-bootstrap';
import visTypes, { sectionsToRender, commonControlPanelSections } from '../stores/visTypes';
import ControlPanelSection from './ControlPanelSection';
import FieldSetRow from './FieldSetRow';
import FieldSet from './FieldSet';
import Filters from './Filters';

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
  onChange(name, value) {
    this.props.actions.setFieldValue(this.props.datasource_type, name, value);
  }
  getFieldData(fs) {
    const fieldOverrides = this.fieldOverrides.bind(this)();
    if (!this.props.fields) {
      return null;
    }
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
  filterSectionsToRender() {
    const filterSections = this.props.datasource_type === 'table' ?
      [commonControlPanelSections.filters[0]] : commonControlPanelSections.filters;
    return filterSections;
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
                onClick={this.removeAlert.bind(this)}
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
                  fields={fieldSets.map(field => (
                    <FieldSet
                      name={field}
                      key={`field-${field}`}
                      onChange={this.onChange.bind(this)}
                      value={this.props.form_data[field]}
                      {...this.getFieldData(field)}
                    />
                  ))}
                />
              ))}
            </ControlPanelSection>
          ))}
          {this.filterSectionsToRender().map((section) => (
            <ControlPanelSection
              key={section.label}
              label={section.label}
              tooltip={section.description}
            >
              <Filters
                filterColumnOpts={[]}
                filters={this.props.form_data.filters}
                actions={this.props.actions}
                prefix={section.prefix}
                datasource_id={this.props.form_data.datasource}
              />
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
