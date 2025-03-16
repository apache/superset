import { OnboardingTeamSearchState } from '../types/teamSearch.types';

export const getTeamSearchData = (state: {
  onboardingTeamSearch: OnboardingTeamSearchState;
}) => ({
  teamsIsLoading: state.onboardingTeamSearch.pending,
  teams: state.onboardingTeamSearch.data,
});
