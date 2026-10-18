import { Anchor } from "@mantine/core";
import type { CurrentUser } from "@mm/lib/auth";

import classes from "./account.module.css";

type ProfileFactsProps = {
  user: CurrentUser;
  onChangeName: () => void;
  onChangeEmail: () => void;
};

const ProfileFacts = ({ user, onChangeName, onChangeEmail }: ProfileFactsProps) => (
  <dl className={classes.facts}>
    <dt>Name</dt>
    <dd>
      <span>{user.name}</span>
      <Anchor component="button" type="button" underline="always" className={classes.factLink} onClick={onChangeName}>
        Change name
      </Anchor>
    </dd>
    <dt>Email</dt>
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
          Change email
        </Anchor>
      ) : (
        <span className={classes.factNote}>You sign in with Google, so Google manages this one.</span>
      )}
    </dd>
  </dl>
);

export default ProfileFacts;
