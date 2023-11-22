import React, { useState } from 'react';
import { SupersetTheme } from '@superset-ui/core';
import { RightOutlined } from '@ant-design/icons';
import DvtMiniNavigation from '../DvtMiniNavigation';
import {
  StyledDvtFolderNavigation,
  DvtFolderNavigationHeader,
  DvtFolderNavigationHeaderTitle,
  DvtFolderNavigationAnimatedIcon,
  DvtFolderNavigationItemsBadge,
  DvtFolderMiniNavigation,
} from './dvt-folder-navigation.module';

export interface DvtFolderNavigationProps {
  data: DataProps[];
}

interface DataProps {
  name: string;
  url: string;
  data: NavigationDataProps[];
}

interface NavigationDataProps {
  name: string;
  url: string;
  data: MiniNavigationTitleProps[];
}

interface MiniNavigationTitleProps {
  name: string;
  url: string;
}

const DvtFolderNavigation: React.FC<DvtFolderNavigationProps> = ({ data }) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  return (
    <StyledDvtFolderNavigation>
      {data.map((item, index) => (
        <>
          <DvtFolderNavigationHeader
            key={index}
            onClick={handleToggle}
            to={item.url}
          >
            <DvtFolderNavigationItemsBadge></DvtFolderNavigationItemsBadge>
            <DvtFolderNavigationHeaderTitle>
              {item.name}
            </DvtFolderNavigationHeaderTitle>
            {item.data.length > 0 && (
              <DvtFolderNavigationAnimatedIcon $fadeIn={isOpen}>
                <RightOutlined
                  css={(theme: SupersetTheme) => ({
                    color: theme.colors.dvt.text.label,
                  })}
                />
              </DvtFolderNavigationAnimatedIcon>
            )}
          </DvtFolderNavigationHeader>
          {isOpen &&
            item.data.map(minItem => (
              <DvtFolderMiniNavigation>
                {minItem.data.length > 0 && (
                  <DvtMiniNavigation
                    title={minItem.name}
                    data={minItem.data}
                  ></DvtMiniNavigation>
                )}
              </DvtFolderMiniNavigation>
            ))}
        </>
      ))}
    </StyledDvtFolderNavigation>
  );
};

export default DvtFolderNavigation;
