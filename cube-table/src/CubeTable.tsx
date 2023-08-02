/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import React, {useEffect, useState} from 'react';
import cubejs from "@cubejs-client/core";
import { styled } from '@superset-ui/core';
import { CubeTableProps, CubeTableStylesProps } from './types';
import { Table, Dropdown, Space, Button, Menu, Modal } from "antd";
import { DownOutlined } from '@ant-design/icons';
import { socket } from './socket';
import { v4 as uuidv4 } from 'uuid';
import {interval} from "rxjs";

const Styles = styled.div<CubeTableStylesProps>`
  padding: ${({ theme }) => theme.gridUnit * 4}px;
  border-radius: ${({ theme }) => theme.gridUnit * 2}px;
  height: ${({ height }) => height}px;
  width: ${({ width }) => width}px;
`;

export default function CubeTable(props: CubeTableProps) {
  const { height, width, filters, dataset, dimensions, actions, blockingAction} = props;
  const [data, setData] = React.useState([]);

  const [isConnected, setIsConnected] = useState(socket.connected);
  const [submitted, setSubmitted] = useState(false);
  const [actionId, setActionId] = useState('Initial value');

  const [subscription, setSubscription] = useState<any>(null);

  const onConnect = () => {
    setIsConnected(true);

    if (subscription !== null) {
      subscription.unsubscribe();
      setSubscription(null);
    }
  }

  const onDisconnect = () => {
    setIsConnected(false);
  }

  useEffect(() => {
    if (subscription === null && !isConnected) {
      setSubscription(interval(1000).subscribe(() => {
        console.log('trying to reconnect');
        socket.connect();
      }));
    }

    if (subscription !== null && isConnected) {
      subscription.unsubscribe();
      setSubscription(null);
    }
  }, [isConnected, subscription]);

  const onUpdateAction = (value: any) => {
    if (value.actionId !== actionId) {
      return;
    }

    Modal.destroyAll();

    if (value.status === 'failed') {
      setSubmitted(false);
      showErrorModal('Iets ging verkeerd helaas');
    }

    if (value.status === 'rejected') {
      setSubmitted(false);
      showErrorModal('Uw actie is gewijgerd. Controleer alle ingevoerde velden of neem contact op met de beheerder.');
    }

    if (value.status === 'completed') {
      setSubmitted(false);

      if (props.blockingAction) {
        showSuccessModal('Uw actie is succesvol uitgevoerd.');
      }
    }

    if (value.status === 'accepted') {
      setSubmitted(props.blockingAction);

      if (props.blockingAction) {
        showAcceptedModal();
      }
    }
  }
  useEffect(() => {
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('updateAction', onUpdateAction);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('updateAction', onUpdateAction);
    };
  }, [actionId]);

  const options = {
    apiToken: 'd60cb603dde98ba3037f2de9eda44938',
    apiUrl: 'http://93.119.15.212:4000/cubejs-api/v1',
  };

  const cubejsApi = cubejs(options.apiToken, options);
  const queryDimensions = dimensions.map((dimension: string) => dataset + "." + dimension);

  const onClick: (data: any, filters: Array<any>) => ((e: any) => void) = (data, filters) => {
    return (e) => {
      const payload = {
        filters,
        data
      }

      const tempId = uuidv4();
      setActionId(tempId);
      setSubmitted(true);

      socket.emit('postAction', {
        payload,
        actionType: e.key,
        actionId: tempId,
      });
      console.log('Action triggered! ', payload);
    };
  };

  const menu = (row: object, filters: Array<any>) => {
    return (
      <Menu onClick={onClick(row, filters)} >
        { actions.map((action: any) => {
          return <Menu.Item key={action.actionType}>{action.actionName}</Menu.Item>
        })}
      </Menu>);
  };

  const [cols, setCols] = React.useState([]);

  useEffect(() => {
    cubejsApi
      .load({
        dimensions: queryDimensions,
      })
      .then((result) => {
        setData(result.loadResponse.results[0].data);
      });
  }, []);

  useEffect(() => {
    const newCols = [
      ...dimensions.map((dimension: string) => {
        return {
          title: dimension,
          dataIndex: dataset + "." + dimension,
          key: dataset + "." + dimension,
        }
      })
    ];

    if (actions.length > 0) {
      newCols.push(
        {
          title: "Acties",
          key: "actions",
          dataIndex: "button",
          render: (text: string, record: object, index: number) => {
            return (<Dropdown overlay={menu(record, filters)}>
              <Button>
                <Space>
                  Acties
                  <DownOutlined/>
                </Space>
              </Button>
            </Dropdown>)
          }
        },
      )
    }

    setCols(newCols)
  }, [filters]);


    return (
    <Styles
      height={height}
      width={width}
    >
      <Table dataSource={data} columns={cols} />
    </Styles>
  );
}



const showAcceptedModal = () => {
  Modal.info({
    title: 'Bezig met verwerken van de actie',
    content: (
      <div>
        <p>Moment geduld aub...</p>
      </div>
    ),
    onOk() {},
    okButtonProps: {
      disabled: true,
      className: 'hidden'
    },
  });
};

const showErrorModal = (message: string) => {
  Modal.error({
    title: 'Er is een fout opgetreden',
    content: (
      <div>
        <p>{message}</p>
      </div>
    ),
    onOk() {},
  });
};

const showSuccessModal = (message: string) => {
  Modal.success({
    title: 'Gelukt!',
    content: (
      <div>
        <p>{message}</p>
      </div>
    ),
    onOk() {},
  });
};
