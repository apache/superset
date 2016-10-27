import React from 'react';
import { connect } from 'react-redux';
import { Panel } from 'react-bootstrap';
import { visTypes } from '../controlPanelMappings';
import ControlPanelSection from './ControlPanelSection';
import FieldSetRow from './FieldSetRow';

const propTypes = {
  vizType: React.PropTypes.string,
};

const defaultProps = {
  vizType: null,
};

function ControlPanelsContainer({ vizType }) {
  const viz = visTypes[vizType];
  return (
    <Panel>
      <div className="scrollbar-container">
        <div className="scrollbar-content">
          {viz.controlPanelSections.map((section) => {
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
