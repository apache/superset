import { t } from '@superset-ui/core';
import Icons from 'src/components/Icons';
import { Link } from 'react-router-dom';
import moment from 'moment';
import CheckboxControl from '../../../../explore/components/controls/CheckboxControl';
import { StyledActions } from './styled';
import { Tooltip } from '../../../../components/Tooltip';
import { REQUEST_PAGE_URL } from '../../consts';

// ------------
// size: xs, xl, xxl
// ------------
export const columns = [
  {
    id: 'id',
    Cell: (props: any) => <span>{props.value}</span>,
    Header: 'id',
    accessor: 'id',
    size: 'xs',
    // disableSortBy: true,
    hidden: false,
  },
  {
    id: 'user',
    Cell: (props: any) => <span>{props.value}</span>,
    Header: t('User'),
    accessor: 'user',
    disableSortBy: true,
  },
  {
    id: 'user.email',
    Cell: (props: any) => <span>{props.value}</span>,
    Header: t('Email'),
    accessor: 'email',
    disableSortBy: true,
  },
  {
    Cell: (props: any) => (
      <Tooltip
        id="requested-roles-tooltip"
        title={props.value}
        placement="bottom"
      >
        <span>{props.value}</span>
      </Tooltip>
    ),
    Header: t('Requested roles'),
    accessor: 'requestedRoles',
    disableSortBy: true,
  },
  {
    id: 'team',
    Cell: (props: any) => (
      <Tooltip id="team-tooltip" title={props.value} placement="bottom">
        <span>{props.value}</span>
      </Tooltip>
    ),
    Header: t('Team'),
    accessor: 'team',
  },
  {
    id: 'created_datetime',
    Cell: (props: any) => (
      <span>{moment(props.value).format('DD/MM/YYYY HH:mm')}</span>
    ),
    Header: t('Request date'),
    accessor: 'requestDate',
    size: 'xs',
  },
  {
    id: 'finished',
    Cell: (props: any) => (
      <div style={{ textAlign: 'center' }}>
        <CheckboxControl hovered value={!!props.value} disabled />
      </div>
    ),
    Header: t('Closed'),
    accessor: 'isClosed',
    size: 'xs',
  },
  {
    Cell: ({ row: { original } }: any) => {
      const openEditModal = () => {};

      return (
        <StyledActions className="actions">
          <Tooltip
            id="edit-action-tooltip"
            title={t('Edit')}
            placement="bottom"
          >
            <Link to={REQUEST_PAGE_URL.replace(':id', original.id)}>
              <span
                role="button"
                tabIndex={0}
                className="action-button"
                onClick={openEditModal}
              >
                <Icons.EditAlt data-test="edit-alt" />
              </span>
            </Link>
          </Tooltip>
        </StyledActions>
      );
    },
    Header: t('Actions'),
    id: 'actions',
    disableSortBy: true,
    hidden: false,
  },
];

export const initialSort = [{ id: 'finished', desc: false }];
