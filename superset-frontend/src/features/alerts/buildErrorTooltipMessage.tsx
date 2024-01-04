import { ValidationObject } from './types';
import { styled } from '@superset-ui/core';

const StyledList = styled.ul`
  margin: 0;
  padding: 0;
  li {
    padding-left: 12px;
  }
`;

export const buildErrorTooltipMessage = (
  build = true,
  setErrorTooltipMessage: Function,
  validationStatus: ValidationObject,
) => {
  if (build) {
    const sectionErrors: string[] = [];
    Object.values(validationStatus).forEach(validationData => {
      if (!validationData.status) {
        const sectionTitle = `${validationData.name}: `;
        sectionErrors.push(sectionTitle + validationData.errors.join(', '));
      }
    });
    setErrorTooltipMessage(
      <div>
        Not all required fields are complete. Please provide the following:
        <StyledList>
          {sectionErrors.map(err => (
            <li key={err}>{err}</li>
          ))}
        </StyledList>
      </div>,
    );
  } else {
    setErrorTooltipMessage('');
  }
};
