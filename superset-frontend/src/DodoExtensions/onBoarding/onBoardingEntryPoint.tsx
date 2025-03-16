import type { FC } from 'react';
import { StepOnePopup } from './components/stepOnePopup/stepOnePopup';
import { StepTwoPopup } from './components/stepTwoPopup/stepTwoPopup';
import { useOnboarding } from './hooks/useOnboarding';
import { StepThreePopup } from './components/stepThreePopup/stepThreePopup';

const OnBoardingEntryPoint: FC = () => {
  const { step, toStepTwo, closeOnboarding, setStep2Passed, setStep3Passed } =
    useOnboarding();

  if (process.env.type !== undefined) {
    return null;
  }

  if (step === 1) {
    return <StepOnePopup onClose={closeOnboarding} onNextStep={toStepTwo} />;
  }
  if (step === 2) {
    return <StepTwoPopup onClose={closeOnboarding} onFinish={setStep2Passed} />;
  }
  if (step === 3) {
    return <StepThreePopup onClose={setStep3Passed} />;
  }

  return null;
};

export { OnBoardingEntryPoint };
