import { renderHook } from '@testing-library/react-hooks';
import { useUnsavedChangesPrompt } from 'src/hooks/useUnsavedChangesPrompt';
import { Router } from 'react-router-dom';
import { createMemoryHistory } from 'history';
import { act } from 'spec/helpers/testing-library';

const history = createMemoryHistory({
  initialEntries: ['/dashboard'],
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <Router history={history}>{children}</Router>
);

describe('useUnsavedChangesPrompt', () => {
  it('should not show modal initially', () => {
    const { result } = renderHook(
      () =>
        useUnsavedChangesPrompt({
          hasUnsavedChanges: true,
          onSave: jest.fn(),
        }),
      { wrapper },
    );

    expect(result.current.showModal).toBe(false);
  });

  it('should block navigation and show modal if there are unsaved changes', () => {
    const { result } = renderHook(
      () =>
        useUnsavedChangesPrompt({
          hasUnsavedChanges: true,
          onSave: jest.fn(),
        }),
      { wrapper },
    );

    // Simulate blocked navigation
    act(() => {
      const unblock = history.block((tx: any) => tx);
      unblock();
      history.push('/another-page');
    });

    expect(result.current.showModal).toBe(true);
  });

  it('should trigger onSave and hide modal on handleSaveAndCloseModal', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);

    const { result } = renderHook(
      () =>
        useUnsavedChangesPrompt({
          hasUnsavedChanges: true,
          onSave,
        }),
      { wrapper },
    );

    await act(async () => {
      await result.current.handleSaveAndCloseModal();
    });

    expect(onSave).toHaveBeenCalled();
    expect(result.current.showModal).toBe(false);
  });

  it('should trigger manual save and not show modal again', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);

    const { result } = renderHook(
      () =>
        useUnsavedChangesPrompt({
          hasUnsavedChanges: true,
          onSave,
        }),
      { wrapper },
    );

    act(() => {
      result.current.triggerManualSave();
    });

    expect(onSave).toHaveBeenCalled();
    expect(result.current.showModal).toBe(false);
  });
});
