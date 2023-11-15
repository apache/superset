import React from 'react';
import { StyledDvtLogo, DvtTitle, DvtLogoImg } from './dvt-logo.module';
import DvtAppLogo from '../../assets/dvt-img/dvtAppLogo.png';

export interface DvtLogoProps {
  title: string;
}

const DvtLogo: React.FC<DvtLogoProps> = ({ title }) => (
  <StyledDvtLogo>
    <DvtLogoImg to="/Dashboard">
      <img src={DvtAppLogo} alt="Logo" />
    </DvtLogoImg>
    <DvtTitle>{title}</DvtTitle>
  </StyledDvtLogo>
);

export default DvtLogo;
