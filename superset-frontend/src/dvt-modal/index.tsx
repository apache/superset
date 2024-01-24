import React, { useRef } from 'react';
import { useDispatch } from 'react-redux';
import useOnClickOutside from '../hooks/useOnClickOutsite';
import { useAppSelector } from '../hooks/useAppSelector';
import { closeModal } from '../dvt-redux/dvt-modalReducer';
import DvtDashboardEdit from './body/dashboard-edit';
import {
  StyledModal,
  StyledModalCard,
  StyledModalCardBody,
  StyledModalCardClose,
} from './dvt-modal.module';

const getComponent = (cmpnt: string) => {
  switch (cmpnt) {
    case 'edit-dashboard':
      return <DvtDashboardEdit />;
    default:
      return <></>;
  }
};
const DvtModal = () => {
  const dispatch = useDispatch();
  const ref = useRef<HTMLDivElement | null>(null);
  useOnClickOutside(ref, () => handleCloseModal());

  const component = useAppSelector(state => state.dvtModal.component);
  const size = (() => {
    switch (component) {
      case 'add-alert':
        return 'medium';
      default:
        return 'small';
    }
  })();
  const handleCloseModal = () => {
    dispatch(closeModal());
  };

  return component ? (
    <StyledModal>
      <StyledModalCard size={size} ref={ref}>
        <StyledModalCardClose onClick={() => handleCloseModal()}>
          X
        </StyledModalCardClose>
        <StyledModalCardBody>{getComponent(component)}</StyledModalCardBody>
      </StyledModalCard>
    </StyledModal>
  ) : (
    <></>
  );
};

export default DvtModal;
