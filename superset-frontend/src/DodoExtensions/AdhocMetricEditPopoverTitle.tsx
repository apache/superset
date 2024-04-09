import { styled } from '@superset-ui/core';
import React from 'react';
import { Tooltip } from 'src/components/Tooltip';
import { Input } from 'src/components/Input';
import {
  TitleWrapper,
  TitleLabel,
  LanguageIndicator,
} from 'src/DodoExtensions/Common/index';

const SYSTEM_LANGUAGES = {
  ru: 'ru',
  en: 'en',
};

const TitlesWrapper = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  flex-direction: column;
`;

interface AdHocMetricTitleEditDisabledProps {
  title?: {
    label?: string;
    labelRU?: string;
    labelEN?: string;
    hasCustomLabel?: boolean;
  };
  defaultLabel: string;
}

const AdHocMetricTitleEditDisabled = ({
  title,
  defaultLabel,
}: AdHocMetricTitleEditDisabledProps) => (
  <Tooltip placement="top" title="You cannot edit a title of saved metric">
    <span
      data-test="AdhocMetricTitle"
      dodo-test="AdhocMetricTitle-isEditDisabled-true"
    >
      {title?.label || title?.labelEN || title?.labelRU || defaultLabel}
    </span>
  </Tooltip>
);

const StyledInput = styled(Input)`
  border-radius: ${({ theme }) => theme.borderRadius};
  height: 26px;
  padding-left: ${({ theme }) => theme.gridUnit * 2.5}px;
  margin-left: 8px;
`;

interface InformativeInputsProps {
  title?: {
    label?: string | undefined;
    labelRU?: string | undefined;
    labelEN?: string | undefined;
    hasCustomLabel?: boolean | undefined;
  };
  editLang: string;
  defaultLabel: string;
  defaultLabelRU: string;
  onChangeEN: React.ChangeEventHandler<HTMLInputElement> | undefined;
  onChangeRU: React.ChangeEventHandler<HTMLInputElement> | undefined;
  handleInputBlurEN: React.FocusEventHandler<HTMLInputElement> | undefined;
  handleInputBlurRU: React.FocusEventHandler<HTMLInputElement> | undefined;
  handleKeyPressEN: React.KeyboardEventHandler<HTMLInputElement> | undefined;
  handleKeyPressRU: React.KeyboardEventHandler<HTMLInputElement> | undefined;
}

const InformativeInputs = ({
  editLang,
  title,
  defaultLabel,
  onChangeEN,
  handleInputBlurEN,
  handleKeyPressEN,
  defaultLabelRU,
  onChangeRU,
  handleInputBlurRU,
  handleKeyPressRU,
}: InformativeInputsProps) => (
  <div>
    {editLang === SYSTEM_LANGUAGES.en && (
      <TitleWrapper>
        <LanguageIndicator language="gb" canEdit={false} />
        <StyledInput
          type="text"
          placeholder={title?.labelEN}
          value={title?.hasCustomLabel ? title.labelEN : defaultLabel}
          onChange={onChangeEN}
          onBlur={handleInputBlurEN}
          onKeyPress={handleKeyPressEN}
          data-test="AdhocMetricEditTitleEN#input"
          dodo-test="StyledInput-isEditMode-true-editLang-en"
        />
      </TitleWrapper>
    )}
    {editLang === SYSTEM_LANGUAGES.ru && (
      <TitleWrapper>
        <LanguageIndicator language="ru" canEdit={false} />
        <StyledInput
          type="text"
          placeholder={title?.labelRU}
          value={title?.hasCustomLabel ? title.labelRU : defaultLabelRU}
          onChange={onChangeRU}
          onBlur={handleInputBlurRU}
          onKeyPress={handleKeyPressRU}
          data-test="AdhocMetricEditTitleRU#input"
          dodo-test="StyledInput-isEditMode-true-editLang-ru"
        />
      </TitleWrapper>
    )}
  </div>
);

interface InformativeInputs2Props {
  title?: {
    label?: string | undefined;
    labelRU?: string | undefined;
    labelEN?: string | undefined;
    hasCustomLabel?: boolean | undefined;
  };
  defaultLabel: string;
  defaultLabelRU: string;
  handleClick: Function;
  handleBlurEN: React.FocusEventHandler<HTMLSpanElement> | undefined;
  handleBlurRU: React.FocusEventHandler<HTMLSpanElement> | undefined;
  handleMouseOverRU: React.MouseEventHandler<HTMLSpanElement> | undefined;
  handleMouseOutRU: React.MouseEventHandler<HTMLSpanElement> | undefined;
}

const InformativeInputs2 = ({
  handleClick,
  handleBlurEN,
  title,
  defaultLabel,
  handleMouseOverRU,
  handleMouseOutRU,
  handleBlurRU,
  defaultLabelRU,
}: InformativeInputs2Props) => (
  <TitlesWrapper>
    <TitleWrapper>
      <LanguageIndicator language="gb" canEdit />
      <Tooltip
        placement="top"
        title={`Click to edit label (${SYSTEM_LANGUAGES.en})`}
      >
        <span
          className="AdhocMetricEditPopoverTitle inline-editable"
          data-test="AdhocMetricEditTitle#trigger"
          onClick={() => handleClick(SYSTEM_LANGUAGES.en)}
          onBlur={handleBlurEN}
          role="button"
          tabIndex={0}
        >
          <TitleLabel>{title?.labelEN || defaultLabel}</TitleLabel>
        </span>
      </Tooltip>
    </TitleWrapper>
    <TitleWrapper>
      <LanguageIndicator language="ru" canEdit />
      <Tooltip
        placement="top"
        title={`Click to edit label (${SYSTEM_LANGUAGES.ru})`}
      >
        <span
          className="AdhocMetricEditPopoverTitle inline-editable"
          data-test="AdhocMetricEditTitle#trigger"
          onMouseOver={handleMouseOverRU}
          onMouseOut={handleMouseOutRU}
          onClick={() => handleClick(SYSTEM_LANGUAGES.ru)}
          onBlur={handleBlurRU}
          role="button"
          tabIndex={0}
        >
          <TitleLabel>{title?.labelRU || defaultLabelRU}</TitleLabel>
        </span>
      </Tooltip>
    </TitleWrapper>
  </TitlesWrapper>
);

export {
  AdHocMetricTitleEditDisabled,
  InformativeInputs,
  InformativeInputs2,
  SYSTEM_LANGUAGES,
};
