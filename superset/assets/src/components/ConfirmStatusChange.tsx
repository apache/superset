import * as React from "react"
// @ts-ignore
import { Modal, Button } from "react-bootstrap"
import { t } from '@superset-ui/translation';

type ShowCallback = (callback: (e: any) => any) => (event: any) => any

interface Props {
  title: string | React.ReactNode,
  description: string | React.ReactNode,
  children: (confirm: ShowCallback) => React.ReactNode
}

interface State {
  open: boolean,
  callback: (e: React.MouseEvent) => void
}

export default class ConfirmStatusChange extends React.Component<Props, State> {
  defaultCallback = () => { }

  state = {
    open: false,
    callback: this.defaultCallback
  }

  show: ShowCallback = callback => event => {
    if (typeof event.preventDefault === 'function') {
      event.preventDefault();

      event = {
        ...event,
        currentTarget: { ...event.currentTarget }
      };
    }

    this.setState({
      open: true,
      callback: () => callback(event)
    })
  }

  hide = () => this.setState({ open: false, callback: this.defaultCallback })

  confirm = () => {
    this.state.callback()
    this.hide()
  }

  render() {
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
    )
  }
}
