import React, { useState } from 'react';
import { css, useTheme } from '@superset-ui/core';

export const RedirectUrlRow = () => {
  const theme = useTheme();
  const [url, setUrl] = useState('');
  const [isEditing, setIsEditing] = useState(true);

  const handleSetUrl = () => {
    setIsEditing(false);
  };

  const handleEditUrl = () => {
    setIsEditing(true);
  };

  return (
    <div
      css={css`
        display: flex;
        align-items: center;
        gap: ${theme.gridUnit * 2}px;
        width: 400px;
        margin-right: 5px;
      `}
      className="redirect-url-row"
    >
      {/* First Part: Redirect URL Label */}
      <span
        css={css`
          font-weight: bold;
        `}
      >
        Redirect URL:
      </span>

      {/* Second Part: Input or Text */}
      {isEditing ? (
        <input
          type="text"
          placeholder="Enter a URL"
          value={url}
          onChange={e => setUrl(e.target.value)}
          css={css`
            flex: 1;
            padding: ${theme.gridUnit}px;
            border: 1px solid ${theme.colors.grayscale.base};
            border-radius: ${theme.borderRadius}px;
            outline: none;
            &:focus {
              border-color: ${theme.colors.primary.base};
              box-shadow: 0 0 4px ${theme.colors.primary.base};
            }
          `}
        />
      ) : (
        <span
          css={css`
            flex: 1;
            color: ${theme.colors.primary.dark1};
            text-overflow: ellipsis;
            overflow: hidden;
            white-space: nowrap;
          `}
          title={url}
        >
          {url || 'No URL set'}
        </span>
      )}
      <button
        css={css`
          display: -webkit-inline-box;
  display: -webkit-inline-flex;
  display: -ms-inline-flexbox;
  display: inline-flex;
  -webkit-align-items: center;
  -webkit-box-align: center;
  -ms-flex-align: center;
  align-items: center;
  -webkit-box-pack: center;
  -ms-flex-pack: center;
  -webkit-justify-content: center;
  justify-content: center;
  line-height: 1.5715;
  font-size: 12px;
  font-weight: 600;
  height: 32px;
  padding: 0px 18px;
  -webkit-transition: all 0.3s;
  transition: all 0.3s;
  box-shadow: none;
  border-width: 0;
  border-style: none;
  border-color: transparent;
  border-radius: 4px;
  color: #1A85A0;
  background-color: #E9F6F9;
  margin-left: 0;
  color: #156378;
        `}
        onClick={isEditing ? handleSetUrl : handleEditUrl}
      >
        {isEditing ? 'Set' : 'Edit'}
      </button>
    </div>
  );
};
