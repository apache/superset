export const SET_EDIT_MODE = 'SET_EDIT_MODE';
export function setEditMode(editMode) {
  return {
    type: SET_EDIT_MODE,
    payload: {
      editMode,
    },
  };
}
