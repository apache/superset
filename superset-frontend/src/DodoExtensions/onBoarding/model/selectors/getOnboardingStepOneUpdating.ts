import { OnboardingStartState } from '../types/start.types';

export const getOnboardingStepOneUpdating = (state: {
  onboardingStart: OnboardingStartState;
}) => state.onboardingStart.stepOneUpdating;
