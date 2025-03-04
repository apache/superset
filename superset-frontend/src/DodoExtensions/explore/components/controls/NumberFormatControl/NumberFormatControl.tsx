// DODO created 44211769
import { t } from '@superset-ui/core';
import { D3_FORMAT_OPTIONS } from '@superset-ui/chart-controls';
import { Select } from 'src/components';
import ControlHeader from 'src/explore/components/ControlHeader';

export interface NumberFormatControlProps {
  value?: string;
  onChange: (format: string) => void;
}

const options = [['', t('Not assigned')], ...D3_FORMAT_OPTIONS].map(option => ({
  value: option[0],
  label: option[1],
}));

export const NumberFormatControl = ({
  value = '',
  onChange,
  ...props
}: NumberFormatControlProps) => (
  <>
    <ControlHeader {...props} />
    <Select
      ariaLabel={t('Number format')}
      options={options}
      placeholder={t('Number format')}
      value={value}
      onChange={onChange}
      onClear={() => onChange('')}
      allowClear
      allowNewOptions
    />
  </>
);
