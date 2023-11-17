import { StyledInputContainer } from "../AlertReportModal";

export default function ScheduleSubsection({}) {


  return (
    <StyledInputContainer>
      <div className="control-label">
        {TRANSLATIONS.SCHEDULE_TYPE_TEXT}
        <span className="required">*</span>
      </div>
      <div className="input-container">
        <Select
          ariaLabel={TRANSLATIONS.SCHEDULE_TYPE_TEXT}
          placeholder={TRANSLATIONS.SCHEDULE_TYPE_TEXT}
          onChange={onLogRetentionChange}
          value={currentAlert?.crontab || ALERT_REPORTS_DEFAULT_CRON_VALUE}
          options={SCHEDULE_TYPE_OPTIONS}
          sortComparator={propertyComparator('value')}
        />
      </div>
    </StyledInputContainer>
  );
}
