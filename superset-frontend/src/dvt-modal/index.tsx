import { useRef } from 'react';
import { useDispatch } from 'react-redux';
import { closeModal } from '../dvt-redux/dvt-modalReducer';
import useOnClickOutside from 'src/hooks/useOnClickOutsite';
import { useAppSelector } from 'src/hooks/useAppSelector';
import {
  StyledModal,
  StyledModalCard,
  StyledModalCardBody,
  StyledModalCardClose,
  StyledModalCardTitle,
} from './dvt-modal.module';
import DvtButton from 'src/components/DvtButton';

export interface ModalProps {
  meta?: any;
  closeModal: () => void | undefined;
}

const getComponent = (cmpnt: string, meta: any, closeModal: () => void) => {
  switch (cmpnt) {
    default:
      return <></>;
  }
};
const DvtModal = () => {
  const dispatch = useDispatch();
  const ref = useRef<HTMLDivElement | null>(null);
  useOnClickOutside(ref, () => handleCloseModal());

  const component = useAppSelector(state => state.modal.component);
  const title = useAppSelector(state => state.modal.title);
  const buttonLabel = useAppSelector(state => state.modal.buttonLabel);
  const buttonOnClick = useAppSelector(state => state.modal.buttonOnClick);
  const meta = useAppSelector(state => state.modal.meta);

  const handleCloseModal = () => {
    dispatch(closeModal());
  };

  return component ? (
    <StyledModal>
      <StyledModalCard ref={ref}>
        <StyledModalCardClose onClick={() => handleCloseModal()} />
        {title && <StyledModalCardTitle>{title}</StyledModalCardTitle>}
        {buttonLabel && (
          <DvtButton label={buttonLabel} onClick={buttonOnClick} />
        )}
        <StyledModalCardBody>
          {getComponent(component, meta, () => handleCloseModal())}
        </StyledModalCardBody>
      </StyledModalCard>
    </StyledModal>
  ) : (
    <></>
  );
};

export default DvtModal;
