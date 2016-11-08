/* eslint camelcase: 0 */
import React, { PropTypes } from 'react';
import { bindActionCreators } from 'redux';
import * as actions from '../actions/exploreActions';
import { connect } from 'react-redux';
import { Panel } from 'react-bootstrap';
import { visTypes, commonControlPanelSections } from '../stores/store';
import ControlPanelSection from './ControlPanelSection';
import FieldSetRow from './FieldSetRow';

const propTypes = {
  viz_type: PropTypes.string,
  datasource_id: PropTypes.number.isRequired,
  datasource_type: PropTypes.string.isRequired,
  actions: PropTypes.object.isRequired,
};

const defaultProps = {
  viz_type: null,
};

class ControlPanelsContainer extends React.Component {
  componentWillMount() {
    const { datasource_id, datasource_type } = this.props;
    if (datasource_id) {
      this.props.actions.setFormOpts(datasource_id, datasource_type);
    }
  }

  onChange(name, value) {
    this.props.actions.setFieldValue(name, value);
  }

  sectionsToRender() {
    const viz = visTypes[this.props.viz_type];
    const { datasourceAndVizType, sqlClause } = commonControlPanelSections;
    const sectionsToRender = [datasourceAndVizType].concat(viz.controlPanelSections, sqlClause);

    return sectionsToRender;
  }

  fieldOverrides() {
    const viz = visTypes[this.props.viz_type];
    return viz.fieldOverrides;
  }

  render() {
    return (
      <Panel>
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
                  />
                ))}
              </ControlPanelSection>
            ))}
           {/* TODO: add filters section */}
          </div>
        </div>
      </Panel>
    );
  }
}

ControlPanelsContainer.propTypes = propTypes;
ControlPanelsContainer.defaultProps = defaultProps;

function mapStateToProps(state) {
  return {
    datasource_id: state.datasource_id,
    datasource_type: state.datasource_type,
    viz_type: state.viz.form_data.viz_type,
  };
}

function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(actions, dispatch),
  };
}

export { ControlPanelsContainer };

export default connect(mapStateToProps, mapDispatchToProps)(ControlPanelsContainer);
