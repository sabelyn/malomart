import type { ReactNode } from "react";

import voices from "@/styles/voices.module.css";

type MaloSaysProps = {
  children: ReactNode;
};

const MaloSays = ({ children }: MaloSaysProps) => (
  <figure className={voices.malo}>
    <blockquote>{children}</blockquote>
    <figcaption>
      <cite>Malo, owner</cite>
    </figcaption>
  </figure>
);

export default MaloSays;
