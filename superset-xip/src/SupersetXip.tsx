import React, {createRef, useEffect, useState} from 'react';
import { styled } from '@superset-ui/core';
import { SupersetXipProps, SupersetXipStylesProps } from './types';
import { FormComponent } from './components/FormComponent';
import { Button, Modal } from 'antd';
import { socket } from './socket';
import { interval } from "rxjs";
import axios from "axios";

const Styles = styled.div<SupersetXipStylesProps>`
  //background-color: ${({ theme }) => theme.colors.secondary.light2};
  padding: ${({ theme }) => theme.gridUnit * 4}px;
  border-radius: ${({ theme }) => theme.gridUnit * 2}px;
  height: ${({ height }) => height}px;
  width: ${({ width }) => width}px;
  
  h4 {
    font-size: 12px;
  }

  .checkbox-label {
    margin-left: 8px;
  }

  .ant-form-item {
    margin-bottom: 12px;
  }
`;

export default function SupersetXip(props: SupersetXipProps) {
  const { height, width, filters, formObject, setDataMask } = props;
  const rootElem = createRef<HTMLDivElement>();
  const initialState = {};

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

  props.formObject.forEach((field) => {
    if (field.field_type === 'checkbox') {
      initialState[field.field_id] = !!field.field_value;
      return;
    }

    initialState[field.field_id] = field.field_value;
  });

  const [formData, setFormData] = React.useState(initialState);

  function handleFormInput(form_id: string, value: any) {
    setFormData({ ...formData, [form_id]: value });
  }

  function handleSubmit() {
    setSubmitted(true);
    applyFilters();

    axios.post('http://localhost:3000/actions', {
      actionType: props.actionIdentifier,
      payload: formData
    })
      .then(function (response) {
        console.log(response.data);

        setActionId(response.data.actionId);
        setSubmitted(false);

        if (props.blockingAction) {
          showAcceptedModal();
        }

      })
      .catch(function (error) {
        console.log(error);
      });
  }

  function applyFilters() {
    let filterForms = formObject.filter((field) => field.field_filter === 'true');

    if (filterForms.length === 0) {
      return;
    }

    const filters = [];

    filterForms.forEach((field) => {
      if (formData[field.field_id] === '' || formData[field.field_id] === undefined) {
        console.log('no value for field', field.field_id);
        return;
      }

      const column = field.field_options.find((option) => option.filter === 'true').dimentions;
      const value = JSON.parse(formData[field.field_id])[field.field_dataset + '.' + column];
      filters.push(getCrossFilterDataMask(column, value, field.field_dataset));
    });

    setDataMask(
      {
        extraFormData: {
          filters: filters,
        },
      }
    );
  }

  return (
    <Styles
      ref={rootElem}
      headerFontSize={props.headerFontSize}
      height={height}
      width={width}
    >
      <form onSubmit={handleSubmit}>
        {props.formObject
          ? props.formObject.map((field, i) => {
              return (
                <FormComponent
                  key={i}
                  field={field}
                  formData={formData}
                  filters={filters}
                  handleFormInput={handleFormInput}
                />
              );
            })
          : null}
        <br />
        <Button
          onClick={() => handleSubmit()}
          disabled={!isConnected || submitted}
          loading={submitted}
          type="primary">{props.buttonText}</Button>
      </form>
    </Styles>
  );
}

const getCrossFilterDataMask = (column: string, value: string, dataset?: string) => {
  return {
          col: column,
          op: 'IN',
          val: [value],
          dataset: dataset,
        }
};


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
