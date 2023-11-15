import { styled } from '@superset-ui/core';
import { Link } from 'react-router-dom';

const StyledDvtLogo = styled.div`
  display: flex;
  align-items: center;
  width: 140px;
  height: 29px;
  gap: 9px;
`;

const DvtTitle = styled.div`
  color: ${({ theme }) => theme.colors.dvt.text.bold};
  font-size: 23.2px;
  font-style: normal;
  font-weight: 700;
  line-height: 125%;
  letter-spacing: -0.29px;
`;

const DvtLogoImg = styled(Link)`
  width: 27.84px;
  height: 27.84px;
`;

export { StyledDvtLogo, DvtTitle, DvtLogoImg };
