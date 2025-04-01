/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
// eslint-disable-next-line
import { Typography } from 'src/components';
import { Tooltip } from 'src/components/Tooltip';
import Card, { CardProps } from 'src/components/Card';
import Icons from 'src/components/Icons';
import { SupersetTheme } from '@superset-ui/core';

export interface IconButtonProps extends CardProps {
  buttonText: string;
  icon: string;
  altText?: string;
}

const IconButton: React.FC<IconButtonProps> = ({
  buttonText,
  icon,
  altText,
  ...cardProps
}) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      if (cardProps.onClick) {
        cardProps.onClick(e as any);
      }
      if (e.key === ' ') {
        e.preventDefault();
      }
    }
    cardProps.onKeyDown?.(e);
  };

  const renderIcon = () => {
    const iconContent = icon ? (
      <img
        src={icon}
        alt={altText || buttonText}
        css={(theme: SupersetTheme) => ({
          width: '100%',
          height: '120px',
          objectFit: 'contain',
        })}
      />
    ) : (
      <div
        css={(theme: SupersetTheme) => ({
          display: 'flex',
          alignContent: 'center',
          alignItems: 'center',
          height: '120px',
        })}
      >
        <Icons.DatabaseOutlined
          css={(theme: SupersetTheme) => ({
            fontSize: '48px',
          })}
          aria-label="default-icon"
        />
      </div>
    );

    return iconContent;
  };

  return (
    <Card
      hoverable
      role="button"
      tabIndex={0}
      aria-label={buttonText}
      onKeyDown={handleKeyDown}
      cover={renderIcon()}
      css={(theme: SupersetTheme) => ({
        padding: '12px',
        textAlign: 'center',
        outline: 'none',
        ':focus': {
          border: `2px solid ${theme.colors.primary.base}`,
          boxShadow: `0 0 0 3px ${theme.colors.primary.light4}`,
        },
        ...cardProps.style,
      })}
      {...cardProps}
    >
      <Tooltip title={buttonText}>
        <Typography.Text ellipsis>{buttonText}</Typography.Text>
      </Tooltip>
    </Card>
  );
};

export { IconButton };
