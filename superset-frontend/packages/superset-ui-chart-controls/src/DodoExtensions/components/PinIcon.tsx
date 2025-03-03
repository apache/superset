// DODO was here
// DODO created 45525377
import { AiFillPushpin } from '@react-icons/all-files/ai/AiFillPushpin';
import { styled } from '@superset-ui/core';

const StyledPinIcon = styled(AiFillPushpin)<{ $isPinned: boolean }>`
  fill: ${props => (props.$isPinned ? '#666666' : `#b7b7b7`)};
  flex-shrink: 0;
  cursor: pointer;
`;

export const PinIcon = ({
  isPinned,
  handlePinning,
}: {
  isPinned: boolean;
  handlePinning: () => void;
}) => {
  const togglePin = (e: React.MouseEvent<SVGElement>) => {
    e.stopPropagation();
    handlePinning();
  };

  return (
    <StyledPinIcon
      style={{ marginRight: '0.5rem' }}
      $isPinned={isPinned}
      onClick={togglePin}
    />
  );
};
