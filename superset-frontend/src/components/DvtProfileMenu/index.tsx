import React from 'react';
import { supersetTheme } from '@superset-ui/core';
import {
  StyledProfile,
  StyledProfileButton,
  StyledProfileMenu,
} from './dvt-profile-menu.module';
import Icon from '../Icons/Icon';

export interface DvtProfileMenuProps {
  img: string;
}

const DvtProfileMenu: React.FC<DvtProfileMenuProps> = ({ img }) => (
  <StyledProfileMenu>
    <StyledProfile src={img} width={48} height={48} alt="Profile" />
    <StyledProfileButton>
      <Icon
        fileName="caret_down"
        iconSize="xl"
        iconColor={supersetTheme.colors.dvt.text.help}
      />
    </StyledProfileButton>
  </StyledProfileMenu>
);

export default DvtProfileMenu;
