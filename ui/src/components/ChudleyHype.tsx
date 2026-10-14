import { Title } from "@mantine/core";
import type { ReactNode } from "react";

import chudleyImage from "@/assets/portraits/chudley.webp";
import voices from "@/styles/voices.module.css";

type ChudleyHypeProps = {
  children: ReactNode;
  heading?: boolean;
};

const ChudleyHype = ({ children, heading = true }: ChudleyHypeProps) => (
  <div className={voices.hypeRow}>
    <img src={chudleyImage} alt="" className={voices.chudley} />
    {heading ? (
      <Title order={1} className={voices.hype}>
        {children}
      </Title>
    ) : (
      <p className={voices.hype}>{children}</p>
    )}
  </div>
);

export default ChudleyHype;
