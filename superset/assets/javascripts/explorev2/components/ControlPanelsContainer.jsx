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
import StyleModal from './StyleModal';

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
  constructor(props) {
    super(props);
    this.state = {
      showModal: false,
    };
  }

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

  toggleModal() {
    this.setState({ showModal: !this.state.showModal });
  }

  render() {
    let flag = false;
    if (this.props.form_data.viz_type === 'table') {
      flag = true;
    }
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

              {flag &&
                <div className="panel panel-default">
                  <div className="panel-heading">
                    <div className="panel-title">Setting style</div>
                  </div>
                  <div className="panel-body">
                    <button
                      type="button"
                      className="btn btn-sm btn-default"
                      data-target="#save_modal"
                      data-toggle="modal"
                      onClick={this.toggleModal.bind(this)}
                    >
                      <i className="fa fa-plus" /> &nbsp; Setting Style
                    </button>
                  </div>
                </div>
              }

              {this.state.showModal &&
                <StyleModal
                  onHide={this.toggleModal.bind(this)}
                  actions={this.props.actions}
                  form_data={this.props.form_data}
                  styles={this.props.form_data.styles}
                  baseStyle={this.props.form_data.baseStyle}
                  colStyles={this.props.form_data.colStyles}
                  compares={this.props.form_data.compares}
                  navigates={this.props.form_data.navigates}
                  slices={this.props.form_data.slices}
                />
              }

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
                  />
                </ControlPanelSection>
              ))}
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
