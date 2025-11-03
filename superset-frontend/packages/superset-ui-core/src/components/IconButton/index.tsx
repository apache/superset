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
import { SupersetTheme, css } from '@superset-ui/core';
import { Typography } from '../Typography';
import { Icons } from '../Icons';
import { Card } from '../Card';
import { Tooltip } from '../Tooltip';
import { CardProps } from '../Card/types';

interface IconButtonProps extends CardProps {
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
    const iconContent = (
      <div
        css={css`
          display: flex;
          align-content: center;
          align-items: center;
          height: 100px;
        `}
      >
        {icon ? (
          <img
            src={icon as string}
            alt={altText || buttonText}
            css={css`
              width: 100%;
              object-fit: contain;
              height: 48px;
            `}
          />
        ) : (
          <Icons.DatabaseOutlined iconSize="xxl" aria-label="default-icon" />
        )}
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
        padding: theme.sizeUnit * 3,
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
export type { IconButtonProps };
