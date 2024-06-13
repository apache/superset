import { AiWrapper } from './AiDrawer.styles';

interface AiDrawerProps {
  open: boolean;
}

export const AiDrawer = ({ open }: AiDrawerProps) => {
  if (!open) return null;

  return (
    <AiWrapper>
      <div>test</div>
      <div>test2</div>
    </AiWrapper>
  );
};
