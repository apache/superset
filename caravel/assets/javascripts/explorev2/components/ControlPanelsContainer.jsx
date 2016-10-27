import React from 'react';
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
  const { defaultSection, datasourceAndVizType, sqlClause } = commonControlPanelSections;
  const sectionsToRender = [datasourceAndVizType, defaultSection].concat(vizSections, sqlClause);
  return sectionsToRender;
}

function ControlPanelsContainer({ vizType }) {
  const viz = visTypes[vizType];
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

ControlPanelsContainer.propTypes = propTypes;
ControlPanelsContainer.defaultProps = defaultProps;

function mapStateToProps(state) {
  return {
    vizType: state.viz.formData.vizType,
  };
}

function mapDispatchToProps() {
  return {};
}

export default connect(mapStateToProps, mapDispatchToProps)(ControlPanelsContainer);
