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
import { Icons } from 'src/components/Icons';
import { SupersetTheme, css } from '@superset-ui/core';

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
        (cardProps.onClick as React.EventHandler<React.SyntheticEvent>)(e);
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
        css={css`
          width: 100%;
          height: 120px;
          object-fit: contain;
        `}
      />
    ) : (
      <div
        css={css`
          display: flex;
          align-content: center;
          align-items: center;
          height: 120px;
        `}
      >
        <Icons.DatabaseOutlined
          css={css`
            font-size: 48px;
          `}
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
        padding: theme.gridUnit * 3,
        textAlign: 'center',
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
