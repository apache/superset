import ToastContainer from 'src/components/MessageToasts/ToastContainer';
import { GlobalStyles } from 'src/GlobalStyles';
import SqlLab from 'src/pages/SqlLab';
import setupApp from 'src/setup/setupApp';
import setupExtensions from 'src/setup/setupExtensions';
import setupPlugins from 'src/setup/setupPlugins';
import { RootContextProviders } from 'src/views/RootContextProviders';
import { BrowserRouter as Router } from 'react-router-dom';
setupApp();
setupPlugins();
setupExtensions();

export const App = () => (
  <Router>
    <RootContextProviders>
      <GlobalStyles />
      <SqlLab />
      <ToastContainer />
    </RootContextProviders>
  </Router>
);
