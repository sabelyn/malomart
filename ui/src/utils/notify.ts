import { notifications } from "@mantine/notifications";
import { createElement, Fragment } from "react";
import { Link } from "react-router";

import { ui } from "@/copy";
import classes from "@/styles/notifications.module.css";

export type NotifyTone = "success" | "info" | "error";

type NotifyAction = { label: string; to: string };

type NotifyOptions = {
  message: string;
  title?: string;
  tone?: NotifyTone;
  action?: NotifyAction;
};

type Announcement = { id: number; message: string; urgent: boolean };

const TONE_COLORS: Record<NotifyTone, string> = { success: "gold", info: "gilt", error: "red" };
const AUTO_CLOSE_MS = 5000;

const listeners = new Set<() => void>();
let announcement: Announcement = { id: 0, message: "", urgent: false };

export const getAnnouncement = () => announcement;

export const subscribeAnnouncements = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const announce = (message: string, urgent = false) => {
  announcement = { id: announcement.id + 1, message, urgent };
  listeners.forEach(listener => listener());
};

const withAction = (message: string, id: string, action?: NotifyAction) =>
  action
    ? createElement(
        Fragment,
        null,
        `${message} `,
        createElement(
          Link,
          { to: action.to, className: classes.action, onClick: () => notifications.hide(id) },
          action.label
        )
      )
    : message;

export const notify = ({ message, title, tone = "success", action }: NotifyOptions) => {
  const id = crypto.randomUUID();
  notifications.show({
    id,
    title,
    message: withAction(message, id, action),
    color: TONE_COLORS[tone],
    role: "none",
    classNames: { root: classes.notification, title: classes.title, description: classes.description },
    autoClose: tone === "error" ? false : AUTO_CLOSE_MS,
    closeButtonProps: { "aria-label": ui.common.dismissNotification }
  });
  announce(title ? `${title}. ${message}` : message, tone === "error");
};

export const clearNotifications = () => {
  notifications.clean();
  announce("");
};
