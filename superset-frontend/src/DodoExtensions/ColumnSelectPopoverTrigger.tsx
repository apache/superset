import React from 'react';
import EditableTitle from 'src/components/EditableTitle';
import { Tooltip } from 'src/components/Tooltip';
import {
  TitleWrapper,
  TitleLabel,
  LanguageIndicator,
} from 'src/DodoExtensions/Common/index';

interface InformativeProps {
  inputLabel: string;
  onLabelChange: Function;
  language: 'gb' | 'ru';
}
type InformativeTitleProps = Omit<InformativeProps, 'onLabelChange'>;

const InformativeInput = ({
  inputLabel,
  onLabelChange,
  language,
}: InformativeProps): any => (
  <TitleWrapper id={`ControlPopover-title-canHaveCustomLabel-true-${language}`}>
    <LanguageIndicator language={language} canEdit />
    <EditableTitle
      title={inputLabel}
      canEdit
      emptyText=""
      onSaveTitle={(value: any) => onLabelChange(value)}
      showTooltip={false}
    />
  </TitleWrapper>
);

const InformativeTitle = ({
  inputLabel,
  language,
}: InformativeTitleProps): any => (
  <TitleWrapper
    dodo-test={`"ControlPopover-title-canHaveCustomLabel-false-${language}"`}
  >
    <LanguageIndicator language={language} canEdit={false} />
    <TitleLabel>{inputLabel}</TitleLabel>
  </TitleWrapper>
);

interface ControlPopoverTitleProps {
  canHaveCustomLabel: boolean;
  popoverLabel: string;
  popoverLabelRU: string;
  onLabelChange: Function;
  onLabelRUChange: Function;
}

const ControlPopoverTitle = ({
  canHaveCustomLabel,
  popoverLabel,
  popoverLabelRU,
  onLabelChange,
  onLabelRUChange,
}: ControlPopoverTitleProps) => (
  <>
    {canHaveCustomLabel && (
      <>
        <InformativeInput
          inputLabel={popoverLabel}
          language="gb"
          onLabelChange={(value: any) => onLabelChange(value)}
        />
        <InformativeInput
          inputLabel={popoverLabelRU}
          language="ru"
          onLabelChange={(value: any) => onLabelRUChange(value)}
        />
      </>
    )}
    {!canHaveCustomLabel && (
      <Tooltip placement="top" title="You cannot edit titles from Dataset">
        <InformativeTitle inputLabel={popoverLabel} language="gb" />
        <InformativeTitle inputLabel={popoverLabelRU} language="ru" />
      </Tooltip>
    )}
  </>
);

export { ControlPopoverTitle };
