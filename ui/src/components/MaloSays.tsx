import type { ReactNode } from "react";

import maloImage from "@/assets/portraits/malo.webp";
import { malo } from "@/copy";
import voices from "@/styles/voices.module.css";

type MaloSaysProps = {
  children: ReactNode;
};

const MaloSays = ({ children }: MaloSaysProps) => (
  <figure className={voices.malo}>
    <img src={maloImage} alt="" className={voices.maloPortrait} />
    <div>
      <blockquote>{children}</blockquote>
      <figcaption>
        <cite>{malo.cite}</cite>
      </figcaption>
    </div>
  </figure>
);

export default MaloSays;
