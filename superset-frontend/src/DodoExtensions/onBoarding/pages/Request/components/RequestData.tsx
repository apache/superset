import { Descriptions } from 'antd';
import { t, useTheme } from '@superset-ui/core';
import { FC, useMemo } from 'react';
import moment from 'moment';
import CheckboxControl from '../../../../../explore/components/controls/CheckboxControl';
import { UserFromEnum } from '../../../types';

type Props = {
  data?: {
    userFrom: UserFromEnum;
    firstName: string;
    lastName: string;
    email: string;
    dodoRole: string;
    currentRoles: Array<string>;
    requestedRoles: Array<string>;
    team: string;
    requestDate: Date;
    isClosed: boolean;
    updateDate: Date;
  };
};

export const RequestData: FC<Props> = ({ data }) => {
  const theme = useTheme();

  const userFrom = useMemo(() => {
    if (data?.userFrom === UserFromEnum.ManagingCompany) {
      return 'Управляющая компания';
    }
    if (data?.userFrom === UserFromEnum.Franchisee) {
      return 'Франчайзи';
    }
    return 'не известно';
  }, [data?.userFrom]);

  return (
    <Descriptions
      title={t('Onboarding request')}
      size="small"
      bordered
      column={{ xxl: 1, xl: 1, lg: 1, md: 1, sm: 1, xs: 1 }}
      labelStyle={{ width: '25%' }}
      contentStyle={{ backgroundColor: theme.colors.grayscale.light5 }}
    >
      <Descriptions.Item label={t('User from')}>{userFrom}</Descriptions.Item>
      <Descriptions.Item label={t('First name')}>
        {data?.firstName}
      </Descriptions.Item>
      <Descriptions.Item label={t('Last name')}>
        {data?.lastName}
      </Descriptions.Item>
      <Descriptions.Item label={t('email')}>{data?.email}</Descriptions.Item>
      <Descriptions.Item label={t('Role in Dodo Brands')}>
        {data?.dodoRole}
      </Descriptions.Item>
      <Descriptions.Item label={t('Current roles')}>
        {data?.currentRoles.join(', ')}
      </Descriptions.Item>
      <Descriptions.Item label={t('Requested roles')}>
        {data?.requestedRoles.join(', ')}
      </Descriptions.Item>
      <Descriptions.Item label={t('Team')}>{data?.team}</Descriptions.Item>
      <Descriptions.Item label={t('Closed')}>
        <CheckboxControl hovered value={data?.isClosed} disabled />
      </Descriptions.Item>
      <Descriptions.Item label={t('Request date')}>
        {moment(data?.requestDate).format('DD/MM/YYYY HH:mm')}
      </Descriptions.Item>
      <Descriptions.Item label={t('Update date')}>
        {moment(data?.updateDate).format('DD/MM/YYYY HH:mm')}
      </Descriptions.Item>
    </Descriptions>
  );
};
