import { ValidationObject } from './types';

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
        <ul>
          {sectionErrors.map(err => (
            <li key={err}>{err}</li>
          ))}
        </ul>
      </div>,
    );
  } else {
    setErrorTooltipMessage('');
  }
};
