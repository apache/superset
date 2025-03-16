import { OnboardingRequestState } from '../types/request.types';

export const getCloseRequestError = (state: {
  onboardingRequest: OnboardingRequestState;
}) => state.onboardingRequest.closingError;
