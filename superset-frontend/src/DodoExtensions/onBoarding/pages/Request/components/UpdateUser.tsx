import { t, useTheme } from '@superset-ui/core';
import { FC } from 'react';
import Modal from 'src/components/Modal';
import { Descriptions } from 'antd';
import { useSelector } from 'react-redux';
import Button from '../../../../../components/Button';
import { Role } from '../../../types';
import { getCloseRequestError } from '../../../model/selectors/getCloseRequestError';
import Alert from '../../../../../components/Alert';

export type UpdateUserDto = {
  userName: string;
  dodoRole?: string;
  currentRoles?: Array<string>;
  requestedRoles?: Array<Role>;
  teamName?: string;
  teamSlug?: string;
};

type Props = {
  onSubmit: () => void;
  onCloseModal: () => void;
  data: UpdateUserDto | null;
};

export const UpdateUser: FC<Props> = ({ onCloseModal, onSubmit, data }) => {
  const theme = useTheme();
  const closeRequestError = useSelector(getCloseRequestError);

  return (
    <Modal
      title={t('User update')}
      show
      onHide={onCloseModal}
      footer={
        <Button htmlType="submit" form="create-team-modal" onClick={onSubmit}>
          {t('Apply roles and link to a team')}
        </Button>
      }
    >
      <Descriptions
        size="small"
        bordered
        column={{ xxl: 1, xl: 1, lg: 1, md: 1, sm: 1, xs: 1 }}
        contentStyle={{
          backgroundColor: theme.colors.grayscale.light5,
        }}
      >
        <Descriptions.Item label={t('User')}>
          {data?.userName}
        </Descriptions.Item>
        <Descriptions.Item label={t('Role in Dodo Brands')}>
          {data?.dodoRole}
        </Descriptions.Item>
        <Descriptions.Item label={t('Current roles')}>
          {data?.currentRoles?.join(', ')}
        </Descriptions.Item>
        <Descriptions.Item label={t('New Roles')}>
          {data?.requestedRoles?.join(', ')}
        </Descriptions.Item>
        <Descriptions.Item label={t('Team')}>
          {data?.teamName}
        </Descriptions.Item>
      </Descriptions>
      {closeRequestError && <Alert message={closeRequestError} type="error" />}
    </Modal>
  );
};
