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
import { t } from '@superset-ui/translation';
import * as React from 'react';
// @ts-ignore
import { Button, Modal } from 'react-bootstrap';

type ShowCallback = (callback: (e: any) => any) => (event: any) => any;

interface Props {
  title: string | React.ReactNode;
  description: string | React.ReactNode;
  children: (confirm: ShowCallback) => React.ReactNode;
}

interface State {
  open: boolean;
  callback: (e: React.MouseEvent) => void;
}
const defaultCallback = () => { console.error('ConfirmStatusChange invoked with the default callback, please provide a function to be called on confirm'); };
export default class ConfirmStatusChange extends React.Component<Props, State> {

  public state = {
    callback: defaultCallback,
    open: false,
  };

  public show: ShowCallback = (callback) => (event) => {
    if (typeof event.preventDefault === 'function') {
      event.preventDefault();

      event = {
        ...event,
        currentTarget: { ...event.currentTarget },
      };
    }

    this.setState({
      callback: () => callback(event),
      open: true,
    });
  }

  public hide = () => this.setState({ open: false, callback: defaultCallback });

  public confirm = () => {
    this.state.callback();
    this.hide();
  }

  public render() {
    return (
      <>
        {this.props.children && this.props.children(this.show)}

        <Modal show={this.state.open} onHide={this.hide}>
          <Modal.Header closeButton={true} >{this.props.title}</Modal.Header>
          <Modal.Body>
            {this.props.description}
          </Modal.Body>
          <Modal.Footer>
            <Button onClick={this.hide}>{t('Cancel')}</Button>
            <Button bsStyle='danger' onClick={this.confirm}>
              {t('OK')}
            </Button>
          </Modal.Footer>
        </Modal>
      </>
    );
  }
}
