export const ONBOARDING_TEAM_REMOVE_USER_PENDING =
  'ONBOARDING_TEAM_REMOVE_USER_PENDING';
export const ONBOARDING_TEAM_REMOVE_USER_SUCCESS =
  'ONBOARDING_TEAM_REMOVE_USER_SUCCESS';
export const ONBOARDING_TEAM_REMOVE_USER_ERROR =
  'ONBOARDING_TEAM_REMOVE_USER_ERROR';
export const ONBOARDING_TEAM_REMOVE_USER_CLEAR =
  'ONBOARDING_TEAM_REMOVE_USER_CLEAR';

type ActionTeamRemoveUserPending = {
  type: typeof ONBOARDING_TEAM_REMOVE_USER_PENDING;
};

type ActionTeamRemoveUserSuccess = {
  type: typeof ONBOARDING_TEAM_REMOVE_USER_SUCCESS;
};

type ActionTeamRemoveUserError = {
  type: typeof ONBOARDING_TEAM_REMOVE_USER_ERROR;
  payload: { error: string };
};

type ActionTeamRemoveUserClear = {
  type: typeof ONBOARDING_TEAM_REMOVE_USER_CLEAR;
};

export type OnboardingTeamRemoveUserAction =
  | ActionTeamRemoveUserPending
  | ActionTeamRemoveUserSuccess
  | ActionTeamRemoveUserError
  | ActionTeamRemoveUserClear;

export type OnboardingTeamRemoveUserState = {
  pending: boolean;
  success: boolean;
  error: string | null;
};
