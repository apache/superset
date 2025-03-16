import { OnboardingRequestListState } from '../types/requestList.types';

export const getRequestListData = (state: {
  onboardingRequestList: OnboardingRequestListState;
}) => state.onboardingRequestList.data;
