export interface IPanelMsgObj {
  title: string;
  date?: string;
  subTitle: string;
  extra?: string;
  listTitle?: string;
  listTitleExtra?: string;
  messages?: string[];
  releases?: {
    date: string;
    status: string;
    messages: string[];
  }[];
  messagesExtra?: string[];
  buttons?: { txt: string; link: string }[];
}

export interface WarningMsgParams {
  title?: string;
  subTitle?: string;
  body?: string;
  extra?: string;
  children?: React.ReactNode;
  colors?: {
    backgroundColor: string;
    textColor: string;
  };
  onClose?: () => void;
}
