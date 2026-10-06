import { Title } from "@mantine/core";
import type { ReactNode } from "react";

import chudleyImage from "@/assets/portraits/chudley.webp";
import voices from "@/styles/voices.module.css";

type ChudleyHypeProps = {
  children: ReactNode;
};

const ChudleyHype = ({ children }: ChudleyHypeProps) => (
  <div className={voices.hypeRow}>
    <img src={chudleyImage} alt="" className={voices.chudley} />
    <Title order={1} className={voices.hype}>
      {children}
    </Title>
  </div>
);

export default ChudleyHype;
