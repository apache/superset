/* eslint camelcase: 0 */
import React, { PropTypes } from 'react';
import { bindActionCreators } from 'redux';
import * as actions from '../actions/exploreActions';
import { connect } from 'react-redux';
import { Panel, Alert } from 'react-bootstrap';
import visTypes, { sectionsToRender, commonControlPanelSections } from '../stores/visTypes';
import ControlPanelSection from './ControlPanelSection';
import FieldSetRow from './FieldSetRow';
import Filters from './Filters';

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
    this.props.actions.setFieldValue(this.props.datasource_type, name, value, label);
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
    return viz.fieldOverrides;
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
  };
}

function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(actions, dispatch),
  };
}

export { ControlPanelsContainer };

export default connect(mapStateToProps, mapDispatchToProps)(ControlPanelsContainer);
