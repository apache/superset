import {
  getByRole,
  render,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import { initialState, defaultQueryEditor } from 'src/SqlLab/fixtures';
import useStoredSidebarWidth from 'src/components/ResizableSidebar/useStoredSidebarWidth';
import SqlEditorSidebarWrapper from './index';

jest.mock('src/components/ResizableSidebar/useStoredSidebarWidth');
jest.mock('src/components/Splitter', () => {
  const Splitter = ({
    onResizeEnd,
    children,
  }: {
    onResizeEnd: (sizes: number[]) => void;
    children: React.ReactNode;
  }) => (
    <div>
      {children}
      <button type="button" onClick={() => onResizeEnd([500])}>
        Resize
      </button>
      <button type="button" onClick={() => onResizeEnd([0])}>
        Resize to zero
      </button>
    </div>
  );
  // eslint-disable-next-line react/display-name
  Splitter.Panel = ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  );
  return { Splitter };
});
jest.mock('@superset-ui/core/components/Grid', () => ({
  ...jest.requireActual('@superset-ui/core/components/Grid'),
  useBreakpoint: jest.fn().mockReturnValue(true),
}));

const defaultProps = {
  children: <div>Child</div>,
};

beforeEach(() => {
  jest.clearAllMocks();
  (useStoredSidebarWidth as jest.Mock).mockReturnValue([250, jest.fn()]);
});

test('renders children', () => {
  const { getByText } = render(<SqlEditorSidebarWrapper {...defaultProps} />, {
    useRedux: true,
    initialState,
  });
  expect(getByText('Child')).toBeInTheDocument();
});

test('calls setWidth on sidebar resize when not hidden', async () => {
  const setWidth = jest.fn();
  (useStoredSidebarWidth as jest.Mock).mockReturnValue([250, setWidth]);
  const { getByRole } = render(<SqlEditorSidebarWrapper {...defaultProps} />, {
    useRedux: true,
    initialState,
  });

  // toggle sidebar to show
  await userEvent.click(getByRole('button', { name: 'Resize' }));
  // set different width
  await userEvent.click(getByRole('button', { name: 'Resize' }));
  await waitFor(() => expect(setWidth).toHaveBeenCalled());
});

test('dispatches toggleLeftBar when sidebar is hidden or width is 0', async () => {
  const setWidth = jest.fn();
  (useStoredSidebarWidth as jest.Mock).mockReturnValue([0, setWidth]);
  const { container } = render(<SqlEditorSidebarWrapper {...defaultProps} />, {
    useRedux: true,
    initialState: {
      ...initialState,
      sqlLab: {
        ...initialState.sqlLab,
        unsavedQueryEditor: {
          id: defaultQueryEditor.id,
          hideLeftBar: false,
        },
      },
    },
  });
  await userEvent.click(
    getByRole(container, 'button', { name: 'Resize to zero' }),
  );
  expect(setWidth).not.toHaveBeenCalled();
});
