import { OnBoardingTeamListState } from '../types/teamList.types';

export const getTeamListData = (state: {
  onboardingTeamList: OnBoardingTeamListState;
}) => state.onboardingTeamList.data;
