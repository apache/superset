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
    const { datasourceId, datasourceType, actions } = this.props;
    if (datasourceId) {
      actions.setFormOpts(datasourceId, datasourceType);
    }
  }

  render() {
    const viz = visTypes[this.props.vizType];
    const sectionsToRender = getSectionsToRender(viz.controlPanelSections);
    return (
      <Panel>
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
      </Panel>
    );
  }
}

ControlPanelsContainer.propTypes = propTypes;
ControlPanelsContainer.defaultProps = defaultProps;

function mapStateToProps(state) {
  return {
    datasourceId: state.datasourceId,
    datasourceType: state.datasourceType,
    vizType: state.viz.formData.vizType,
  };
}

function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(actions, dispatch),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(ControlPanelsContainer);
