import React from 'react';
import { bindActionCreators } from 'redux';
import * as actions from '../actions/exploreActions';
import { connect } from 'react-redux';
import { Panel } from 'react-bootstrap';
import { visTypes, commonControlPanelSections } from '../stores/store';
import ControlPanelSection from './ControlPanelSection';
import FieldSetRow from './FieldSetRow';

const propTypes = {
  vizType: React.PropTypes.string,
};

const defaultProps = {
  vizType: null,
};

function getSectionsToRender(vizSections) {
  const { datasourceAndVizType, sqlClause } = commonControlPanelSections;
  const sectionsToRender = [datasourceAndVizType].concat(vizSections, sqlClause);
  return sectionsToRender;
}

class ControlPanelsContainer extends React.Component {
  componentWillMount() {
    this.props.state.datasourceId
    if (this.props.state.datasourceId) {
      this.props.actions.setFormOpts(this.props.state.datasourceId, this.props.state.datasourceType);
    }
  }

  render() {
    const viz = visTypes[this.props.vizType];
    const sectionsToRender = getSectionsToRender(viz.controlPanelSections);
    return (
      <div className="panel panel-default">
        <div className="scrollbar-container">
          <div className="scrollbar-content">
            {sectionsToRender.map((section) => {
              return (
                <ControlPanelSection
                  label={section.label}
                  tooltip={section.description}
                >
                  {section.fieldSetRows.map((fieldSets) => {
                    return <FieldSetRow fieldSets={fieldSets} />;
                  })}
                </ControlPanelSection>
              );
            })}
           {/* TODO: add filters section */}
          </div>
        </div>
      </div>
    );
  }
}

ControlPanelsContainer.propTypes = propTypes;
ControlPanelsContainer.defaultProps = defaultProps;

function mapStateToProps(state) {
  return {
    state: state,
    vizType: state.viz.formData.vizType,
  };
}

function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(actions, dispatch),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(ControlPanelsContainer);
