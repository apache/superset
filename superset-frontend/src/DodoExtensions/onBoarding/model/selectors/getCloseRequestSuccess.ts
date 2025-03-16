import { OnboardingRequestState } from '../types/request.types';

export const getCloseRequestSuccess = (state: {
  onboardingRequest: OnboardingRequestState;
}) => state.onboardingRequest.closingSuccess;
