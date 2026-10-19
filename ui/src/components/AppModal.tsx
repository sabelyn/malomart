import { Modal } from "@mantine/core";
import type { ReactNode } from "react";

import { ui } from "@/copy";
import classes from "./AppModal.module.css";

type AppModalProps = {
  opened: boolean;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  onClose: () => void;
  onExitTransitionEnd?: () => void;
};

const AppModal = ({ opened, title, description, children, onClose, onExitTransitionEnd }: AppModalProps) => (
  <Modal.Root
    opened={opened}
    onClose={onClose}
    onExitTransitionEnd={onExitTransitionEnd}
    centered
    classNames={{ content: classes.content, header: classes.header, title: classes.title }}
  >
    <Modal.Overlay backgroundOpacity={0.5} blur={2} />
    <Modal.Content>
      <Modal.Header component="div">
        <Modal.Title>{title}</Modal.Title>
        <Modal.CloseButton aria-label={ui.common.close} />
      </Modal.Header>
      {description && <Modal.Body className={classes.description}>{description}</Modal.Body>}
      <div className={classes.body}>{children}</div>
    </Modal.Content>
  </Modal.Root>
);

export default AppModal;
