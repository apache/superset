import React from 'react';
import DvtButton from 'src/components/DvtButton';
import DvtIconDataLabel from 'src/components/DvtIconDataLabel';
import {
  StyledDatasetsIconLabel,
  StyledNewDatasetsButtons,
} from './dvt-new-datasets.module';

function DvtNewDatasets() {
  return (
    <div>
      <StyledDatasetsIconLabel>
        <DvtIconDataLabel
          label="Select dataset source"
          description="You can create a new chart or use existing ones from the panel on the right."
          icon="square"
        />
      </StyledDatasetsIconLabel>
      <StyledNewDatasetsButtons>
        <DvtButton
          label="Cancel"
          size="small"
          colour="primary"
          typeColour="basic"
          onClick={() => {}}
        />
        <DvtButton
          label="Create Dataset and Create Chart"
          size="small"
          colour="grayscale"
          typeColour="basic"
          onClick={() => {}}
        />
      </StyledNewDatasetsButtons>
    </div>
  );
}

export default DvtNewDatasets;
