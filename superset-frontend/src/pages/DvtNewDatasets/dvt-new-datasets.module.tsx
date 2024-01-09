import { styled } from '@superset-ui/core';

const StyledDvtNewDatasets = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  align-items: center;
`;

const StyledNewDatasetsButtons = styled.div`
  display: inline-flex;
  flex-direction: row;
  justify-content: flex-end;
  align-items: center;
  gap: 24px;
  width: 100%;
  padding-right: 20px;
  margin-top: auto;
`;

const StyledDatasetsIconLabel = styled.div`
  display: flex;
  margin-top: auto;
`;

export {
  StyledDvtNewDatasets,
  StyledNewDatasetsButtons,
  StyledDatasetsIconLabel,
};
