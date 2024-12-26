import React, { useContext, useState } from 'react';
import URLContext from '../../contexts/URLContext.jsx';
import { css, useTheme } from '@superset-ui/core';

const SetURL = ({ instanceId }) => {
  const theme = useTheme();
  const { setURL } = useContext(URLContext);
  const [inputValue, setInputValue] = useState('');
  const [isEditing, setIsEditing] = useState(true);

  const handleEditUrl = () => {
    setIsEditing(true);
  };

  const handleSetURL = () => {
    setIsEditing(false);
    setURL(instanceId, inputValue);
  };

  return (
    <div
      css={css`
            display: flex;
            align-items: center;
            gap: ${theme.gridUnit * 2}px;
            margin-right: 5px;
          `}
      className="redirect-url-row"
    >
      {isEditing ? (
        <input
          type="url"
          placeholder="Enter redirection URL"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          css={css`
                flex: 1;
                padding: ${theme.gridUnit}px;
                  border: 1px solid #d9d9d9;
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
          title={inputValue}
        >
          {inputValue || 'No URL set'}
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
        onClick={isEditing ? handleSetURL : handleEditUrl}
      >
        {isEditing ? 'Set URL' : 'Edit URL'}
      </button>
    </div>
  );
};

export default SetURL;
