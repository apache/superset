import { OnboardingRequestState } from '../types/request.types';

export const getRequestData = (state: {
  onboardingRequest: OnboardingRequestState;
}) => state.onboardingRequest.requestData;
