import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';
import { SupersetTheme } from '@superset-ui/core';
import { RightOutlined } from '@ant-design/icons';
import DvtMiniNavigation from '../DvtMiniNavigation';
import {
  StyledDvtFolderNavigation,
  DvtFolderNavigationItem,
  DvtFolderNavigationHeader,
  DvtFolderNavigationHeaderTitle,
  DvtFolderNavigationAnimatedIcon,
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
  const history = useHistory();
  const [activeName, setActiveName] = useState<string>('');

  const handleToggleOrUrl = (dataLength: number, url: string, name: string) => {
    if (dataLength) {
      setActiveName(name === activeName ? '' : name);
    } else {
      history.push(url);
    }
  };

  return (
    <StyledDvtFolderNavigation>
      {data.map((item, index) => (
        <DvtFolderNavigationItem>
          <DvtFolderNavigationHeader
            key={index}
            onClick={() =>
              handleToggleOrUrl(item.data.length, item.url, item.name)
            }
          >
            <DvtFolderNavigationHeaderTitle>
              {item.name}
            </DvtFolderNavigationHeaderTitle>
            <DvtFolderNavigationAnimatedIcon $fadeIn={activeName === item.name}>
              {item.data.length > 0 && (
                <RightOutlined
                  css={(theme: SupersetTheme) => ({
                    color: theme.colors.dvt.text.label,
                  })}
                />
              )}
            </DvtFolderNavigationAnimatedIcon>
          </DvtFolderNavigationHeader>
          {activeName === item.name &&
            item.data.map((minItem, index) => (
              <DvtFolderMiniNavigation key={index}>
                <DvtMiniNavigation
                  title={minItem.name}
                  url={minItem.url}
                  data={minItem.data}
                />
              </DvtFolderMiniNavigation>
            ))}
        </DvtFolderNavigationItem>
      ))}
    </StyledDvtFolderNavigation>
  );
};

export default DvtFolderNavigation;
