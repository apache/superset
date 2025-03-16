import { OnboardingUserSearchState } from '../types/userSearch.types';

export const getUserSearchData = (state: {
  onboardingUserSearch: OnboardingUserSearchState;
}) => state.onboardingUserSearch.data;
