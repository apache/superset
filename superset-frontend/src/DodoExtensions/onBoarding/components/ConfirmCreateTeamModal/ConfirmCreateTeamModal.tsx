import { t, useTheme } from '@superset-ui/core';
import type { FC } from 'react';
import { Descriptions, Typography } from 'antd';
import { useSelector } from 'react-redux';
import Button from '../../../../components/Button';
import Modal from '../../../../components/Modal';
import { Role, UserFromEnum } from '../../types';
import { getCreateTeamError } from '../../model/selectors/getCreateTeamError';
import Alert from '../../../../components/Alert';

export type ConfirmCreateTeamModalDto = {
  userFrom: UserFromEnum;
  teamName: string;
  teamSlug: string;
  roles: Array<Role>;
};

type ConfirmCreateTeamModalProps = {
  onCloseModal: () => void;
  onSubmit: (value: ConfirmCreateTeamModalDto) => void;
  data: ConfirmCreateTeamModalDto;
  showUpdateUserInfo?: boolean;
};

export const ConfirmCreateTeamModal: FC<ConfirmCreateTeamModalProps> = ({
  onCloseModal,
  onSubmit,
  data,
  showUpdateUserInfo = true,
}) => {
  const theme = useTheme();
  const createdTeamError = useSelector(getCreateTeamError);

  return (
    <Modal
      title={t('Create new team')}
      show
      onHide={onCloseModal}
      footer={
        <Button onClick={() => onSubmit(data)}>{t('Create team')}</Button>
      }
    >
      <Typography.Paragraph>
        <Descriptions
          size="small"
          bordered
          column={{ xxl: 1, xl: 1, lg: 1, md: 1, sm: 1, xs: 1 }}
          contentStyle={{
            backgroundColor: theme.colors.grayscale.light5,
          }}
        >
          <Descriptions.Item label={t('User from')}>
            {t(data?.userFrom)}
          </Descriptions.Item>
          <Descriptions.Item label={t('Team')}>
            {data?.teamName}
          </Descriptions.Item>
          <Descriptions.Item label={t('slug')}>
            {data?.teamSlug}
          </Descriptions.Item>
          <Descriptions.Item label={t('Roles')}>
            {data?.roles.join(', ')}
          </Descriptions.Item>
        </Descriptions>
      </Typography.Paragraph>
      <Typography.Paragraph>
        {t('New team will be created')}
      </Typography.Paragraph>
      {showUpdateUserInfo && (
        <Typography.Paragraph>
          {t('User will update is on the next step')}
        </Typography.Paragraph>
      )}
      {createdTeamError && <Alert message={createdTeamError} type="error" />}
    </Modal>
  );
};
