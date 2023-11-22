import { styled } from '@superset-ui/core';

interface DvtButtonProps {
  $label?: string;
  $colour: 'primary' | 'success' | 'grayscale';
  $typeColour: 'basic' | 'powder' | 'outline';
  $maxWidth?: boolean;
}

const StyledDvtButton = styled.button<DvtButtonProps>`
  display: flex;
  align-items: center;
  cursor: pointer;
  gap: 5px;
  ${({ $maxWidth }) =>
    $maxWidth ? 'display: flex;' : 'display: inline-flex;'};
  padding: 8px 12px;
  border-radius: 8px;
  border: none;
  ${({ $typeColour, $colour, theme }) => {
    const colourFinder = {
      primary: {
        basic: 'base',
        powder: 'light3',
        outline: 'base',
      },
      success: {
        basic: 'dark1',
        powder: 'light3',
        outline: 'dark1',
      },
      grayscale: {
        basic: 'base',
        powder: 'light2',
        outline: 'base',
      },
    };

    const colourFinderColor = {
      primary:{
        powder: 'base',
        outline: 'base',
      },
      success: {
        powder: 'base',
        outline: 'dark2',
      },
      grayscale: {
        powder: 'base',
        outline: 'base',
      }
    }

    return `
      background-color: ${
        $typeColour === 'outline'
          ? 'transparent'
          : theme.colors.dvt[$colour][colourFinder[$colour][$typeColour]]
      };
      color: ${
        $typeColour === 'basic'
          ? theme.colors.grayscale.light5
          : theme.colors.dvt[$colour][colourFinderColor[$colour][$typeColour]]
      };
    `;
  }};
`;
export { StyledDvtButton };
