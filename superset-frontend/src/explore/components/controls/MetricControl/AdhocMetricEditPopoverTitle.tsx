// DODO was here (TODO)
import React, {
  ChangeEventHandler,
  FocusEvent,
  KeyboardEvent,
  useCallback,
  useState,
} from 'react';
import { t, styled } from '@superset-ui/core';
import { Input } from 'src/components/Input';
import { Tooltip } from 'src/components/Tooltip';

const TitleLabel = styled.span`
  display: inline-block;
  padding: 2px 0;
`;

const StyledInput = styled(Input)`
  border-radius: ${({ theme }) => theme.borderRadius};
  height: 26px;
  padding-left: ${({ theme }) => theme.gridUnit * 2.5}px;
`;

export interface AdhocMetricEditPopoverTitleProps {
  title?: {
    label?: string;
    hasCustomLabel?: boolean;
  };
  isEditDisabled?: boolean;
  onChange: ChangeEventHandler<HTMLInputElement>;
}

const AdhocMetricEditPopoverTitle: React.FC<AdhocMetricEditPopoverTitleProps> =
  ({ title, isEditDisabled, onChange }) => {
    const [isHovered, setIsHovered] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);

    const defaultLabel = t('My metric');

    const handleMouseOver = useCallback(() => setIsHovered(true), []);
    const handleMouseOut = useCallback(() => setIsHovered(false), []);
    const handleClick = useCallback(() => setIsEditMode(true), []);
    const handleBlur = useCallback(() => setIsEditMode(false), []);

    const handleKeyPress = useCallback(
      (ev: KeyboardEvent<HTMLInputElement>) => {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          handleBlur();
        }
      },
      [handleBlur],
    );

    const handleInputBlur = useCallback(
      (e: FocusEvent<HTMLInputElement>) => {
        if (e.target.value === '') {
          onChange(e);
        }

        handleBlur();
      },
      [onChange, handleBlur],
    );

    if (isEditDisabled) {
      return (
        <span data-test="AdhocMetricTitle">{title?.label || defaultLabel}</span>
      );
    }

    if (isEditMode) {
      return (
        <StyledInput
          type="text"
          placeholder={title?.label}
          value={title?.hasCustomLabel ? title.label : ''}
          autoFocus
          onChange={onChange}
          onBlur={handleInputBlur}
          onKeyPress={handleKeyPress}
          data-test="AdhocMetricEditTitle#input"
        />
      );
    }

    return (
      <Tooltip placement="top" title={t('Click to edit label')}>
        <span
          className="AdhocMetricEditPopoverTitle inline-editable"
          data-test="AdhocMetricEditTitle#trigger"
          onMouseOver={handleMouseOver}
          onMouseOut={handleMouseOut}
          onClick={handleClick}
          onBlur={handleBlur}
          role="button"
          tabIndex={0}
        >
          <TitleLabel>{title?.label || defaultLabel}</TitleLabel>
          &nbsp;
          <i
            className="fa fa-pencil"
            style={{ color: isHovered ? 'black' : 'grey' }}
          />
        </span>
      </Tooltip>
    );
  };

export default AdhocMetricEditPopoverTitle;
