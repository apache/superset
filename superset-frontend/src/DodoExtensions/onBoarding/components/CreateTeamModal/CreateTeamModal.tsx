import { useForm } from 'antd/es/form/Form';
import { ChangeEvent, FC, useCallback } from 'react';
import { Typography } from 'antd';
import { t } from '@superset-ui/core';
import Modal from '../../../../components/Modal';
import { Role, UserFromEnum } from '../../types';
import { Form, FormItem } from '../../../../components/Form';
import { Input } from '../../../../components/Input';
import Button from '../../../../components/Button';
import { getTeamName } from '../../utils/getTeamName';
import { Select } from '../../../../components';
import { SelectProps } from '../../../../components/Select/types';
import { getTeamSlug } from '../../utils/getTeamSlug';
import { MAX_TEAM_NAME_LENGTH, MIN_TEAM_NAME_LENGTH } from '../../consts';

export type CreateTeamModalDto = {
  userFrom?: UserFromEnum;
  name: string | null;
  teamName: string;
  teamSlug: string;
  roles: Array<Role>;
};

const RolesList: SelectProps['options'] = [
  {
    label: t(Role.Readonly),
    value: Role.Readonly,
  },
  {
    label: t(Role.CreateData),
    value: Role.CreateData,
  },
  {
    label: t(Role.VizualizeData),
    value: Role.VizualizeData,
  },
];

const FromList: SelectProps['options'] = [
  {
    label: `${UserFromEnum.ManagingCompany}`,
    value: UserFromEnum.ManagingCompany,
  },
  {
    label: `${UserFromEnum.Franchisee}`,
    value: UserFromEnum.Franchisee,
  },
];

type Props = {
  onCloseModal: () => void;
  onSubmit: (data: CreateTeamModalDto) => void;
  data: CreateTeamModalDto;
};

export const CreateTeamModal: FC<Props> = ({
  onCloseModal,
  onSubmit,
  data,
}) => {
  const [form] = useForm();

  const setNameAndTag = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const from = form.getFieldValue('userFrom');
      form.setFieldsValue({
        teamName: getTeamName(event.target.value, from),
        teamSlug: getTeamSlug(event.target.value, from),
      });
    },
    [form],
  );

  const clear = useCallback(() => {
    form.setFieldsValue({
      name: '',
      teamName: '',
      teamSlug: '',
      roles: [],
    });
  }, [form]);

  const handleRoleKeyPress = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      const reg = /^-?[0-9a-zA-Z ]*(\.[0-9a-zA-Z ]*)?$/;
      if (!reg.test(event.key)) {
        event.preventDefault();
      }
    },
    [],
  );

  return (
    <Modal
      title={t('Create new team')}
      show
      onHide={onCloseModal}
      footer={
        <Button htmlType="submit" form="create-team-modal">
          {t('Next')}
        </Button>
      }
    >
      <Form
        layout="vertical"
        form={form}
        name="create-team-modal"
        onFinish={onSubmit}
        initialValues={data}
      >
        <Typography.Title level={4}>
          {t('New team will be created')}
        </Typography.Title>
        <FormItem
          name="userFrom"
          label={t('User from')}
          rules={[{ required: true }]}
        >
          <Select
            allowClear
            placeholder={t('User from')}
            options={FromList}
            oneLine={false}
            maxTagCount={10}
            disabled={!!data.userFrom}
            onChange={clear}
          />
        </FormItem>
        <FormItem
          name="name"
          label={t('Team Name')}
          rules={[
            { required: true },
            {
              min: MIN_TEAM_NAME_LENGTH,
              message: t('Too short'),
            },
            {
              max: MAX_TEAM_NAME_LENGTH,
              message: t('Too long'),
            },
          ]}
        >
          <Input onChange={setNameAndTag} onKeyPress={handleRoleKeyPress} />
        </FormItem>
        <FormItem
          name="teamName"
          label={t('Full Team Name')}
          rules={[{ required: true }]}
        >
          <Input disabled />
        </FormItem>
        <FormItem
          name="teamSlug"
          label={t('slug')}
          rules={[{ required: true }]}
        >
          <Input disabled />
        </FormItem>

        <FormItem name="roles" label={t('Roles')} rules={[{ required: true }]}>
          <Select
            mode="multiple"
            allowClear
            placeholder={t('Roles')}
            options={RolesList}
            oneLine={false}
            maxTagCount={10}
          />
        </FormItem>
        <FormItem name="userFrom" />
      </Form>
    </Modal>
  );
};
