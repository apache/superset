import React, { ReactNode } from 'react';
import { SupersetClient, Method, makeApi, SupersetApiError } from '@superset-ui/core';
import ErrorMessage from './ErrorMessage';

export type Props = {
  children: ({ payload }: { payload?: object }) => ReactNode;
  endpoint?: string;
  host: string;
  method?: Method;
  postPayload?: string;
};

type State = {
  didVerify: boolean;
  error?: Error | SupersetApiError;
  payload?: object;
};

export const renderError = (error: Error) => (
  <div>
    The following error occurred, make sure you have <br />
    1) configured CORS in Superset to receive requests from this domain. <br />
    2) set the Superset host correctly below. <br />
    3) debug the CORS configuration under the `@superset-ui/connection` stories.
    <br />
    <br />
    <ErrorMessage error={error} />
  </div>
);

export default class VerifyCORS extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { didVerify: false };
    this.handleVerify = this.handleVerify.bind(this);
  }

  componentDidUpdate(prevProps: Props) {
    const { endpoint, host, postPayload, method } = this.props;
    if (
      (this.state.didVerify || this.state.error) &&
      (prevProps.endpoint !== endpoint ||
        prevProps.host !== host ||
        prevProps.postPayload !== postPayload ||
        prevProps.method !== method)
    ) {
      // eslint-disable-next-line react/no-did-update-set-state
      this.setState({ didVerify: false, error: undefined });
    }
  }

  handleVerify() {
    const { endpoint, host, postPayload, method } = this.props;
    SupersetClient.reset();
    SupersetClient.configure({
      credentials: 'include',
      host,
      mode: 'cors',
    })
      .init()
      .then(() => {
        // Test an endpoint if specified
        if (endpoint && postPayload) {
          return makeApi({
            endpoint,
            method,
          })(postPayload);
        }
        return { error: 'Must provide valid endpoint and payload.' };
      })
      .then(result => this.setState({ didVerify: true, error: undefined, payload: result }))
      .catch(error => this.setState({ error }));
  }

  render() {
    const { didVerify, error, payload } = this.state;
    const { children } = this.props;

    return didVerify ? (
      children({ payload })
    ) : (
      <div className="row">
        <div className="col-md-10">
          This example requires CORS requests from this domain. <br />
          <br />
          1) enable CORS requests in your Superset App from {`${window.location.origin}`}
          <br />
          2) configure your Superset App host name below <br />
          3) click below to verify authentication. You may debug CORS further using the
          `@superset-ui/connection` story. <br />
          <br />
          <button type="button" className="btn btn-primary btn-sm" onClick={this.handleVerify}>
            Verify
          </button>
          <br />
          <br />
        </div>

        {error && (
          <div className="col-md-8">
            <ErrorMessage error={error} />
          </div>
        )}
      </div>
    );
  }
}
