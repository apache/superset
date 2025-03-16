import { OnboardingStartState } from '../types/start.types';

export const getOnboardingFinishUpdating = (state: {
  onboardingStart: OnboardingStartState;
}) => state.onboardingStart.finishUpdating;
