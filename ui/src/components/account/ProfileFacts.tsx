import { Anchor } from "@mantine/core";
import type { CurrentUser } from "@mm/lib/auth";

import { ui } from "@/copy";
import classes from "./account.module.css";

type ProfileFactsProps = {
  user: CurrentUser;
  onChangeName: () => void;
  onChangeEmail: () => void;
};

const ProfileFacts = ({ user, onChangeName, onChangeEmail }: ProfileFactsProps) => (
  <dl className={classes.facts}>
    <dt>{ui.profile.name}</dt>
    <dd>
      <span>{user.name}</span>
      <Anchor component="button" type="button" underline="always" className={classes.factLink} onClick={onChangeName}>
        {ui.profile.changeName}
      </Anchor>
    </dd>
    <dt>{ui.profile.email}</dt>
    <dd>
      <span>{user.email}</span>
      {user.signInMethod === "email" ? (
        <Anchor
          component="button"
          type="button"
          underline="always"
          className={classes.factLink}
          onClick={onChangeEmail}
        >
          {ui.profile.changeEmail}
        </Anchor>
      ) : (
        <span className={classes.factNote}>{ui.profile.googleManagesEmail}</span>
      )}
    </dd>
  </dl>
);

export default ProfileFacts;
