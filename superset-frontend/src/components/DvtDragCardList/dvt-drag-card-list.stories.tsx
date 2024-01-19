import React from 'react';
import DvtDargCardList, { DvtDragCardListProps } from './index';

export default {
  title: 'Dvt-Components/DvtDargCardList',
  component: DvtDargCardList,
};

export const Default = (args: DvtDragCardListProps) => (
  <div style={{ width: 217 }}>
    <DvtDargCardList {...args} />
  </div>
);

Default.args = {
  data: [
    {
      label: 'Kayıt Tarihi',
      value: { id: 1, name: 'Kayit_Tarihi' },
      icon: 'dvt-hashtag',
    },
    { label: 'bas_tar', value: { id: 1, name: 'bas_tar' }, icon: 'clock' },
    { label: 'arac_key', value: { id: 1, name: 'arac_key' }, icon: 'question' },
    { label: 'arac_id', value: { id: 1, name: 'arac_id' }, icon: 'field_abc' },
    {
      label: 'Kayıt Tarihi',
      value: { id: 1, name: 'Kayit_Tarihi' },
      icon: 'dvt-hashtag',
    },
    { label: 'bas_tar', value: { id: 1, name: 'bas_tar' }, icon: 'clock' },
    { label: 'arac_key', value: { id: 1, name: 'arac_key' }, icon: 'question' },
    { label: 'arac_id', value: { id: 1, name: 'arac_id' }, icon: 'field_abc' },
    {
      label: 'Kayıt Tarihi',
      value: { id: 1, name: 'Kayit_Tarihi' },
      icon: 'dvt-hashtag',
    },
    { label: 'bas_tar', value: { id: 1, name: 'bas_tar' }, icon: 'clock' },
    { label: 'arac_key', value: { id: 1, name: 'arac_key' }, icon: 'question' },
    { label: 'arac_id', value: { id: 1, name: 'arac_id' }, icon: 'field_abc' },
  ],
};
