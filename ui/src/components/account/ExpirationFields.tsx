import { Group, NativeSelect } from "@mantine/core";
import type { GetInputPropsReturnType } from "@mantine/form";
import { string } from "zod";

import { isExpired } from "@/components/account/accountDisplay";

const YEARS_AHEAD = 15;

export const expirationFields = {
  expirationMonth: string().nonempty({ error: "Choose a month." }).transform(Number),
  expirationYear: string().nonempty({ error: "Choose a year." }).transform(Number)
};

export const notExpired = (value: { expirationMonth: number; expirationYear: number }) => !isExpired(value);

export const expiredIssue = { error: "That card has expired.", path: ["expirationYear"] };

const MONTHS = Array.from({ length: 12 }, (_, month) => ({
  value: String(month),
  label: String(month + 1).padStart(2, "0")
}));

const yearOptions = (current?: number) => {
  const thisYear = new Date().getFullYear();
  const first = Math.min(thisYear, current ?? thisYear);
  return Array.from({ length: thisYear + YEARS_AHEAD - first + 1 }, (_, i) => String(first + i));
};

type ExpirationFieldsProps = {
  autoFocus?: boolean;
  currentYear?: number;
  monthProps: GetInputPropsReturnType;
  yearProps: GetInputPropsReturnType;
};

const ExpirationFields = ({ autoFocus, currentYear, monthProps, yearProps }: ExpirationFieldsProps) => (
  <Group grow align="flex-start">
    <NativeSelect
      label="Expiration month"
      autoComplete="cc-exp-month"
      required
      data-autofocus={autoFocus || undefined}
      data={[{ value: "", label: "Month", disabled: true }, ...MONTHS]}
      {...monthProps}
    />
    <NativeSelect
      label="Expiration year"
      autoComplete="cc-exp-year"
      required
      data={[{ value: "", label: "Year", disabled: true }, ...yearOptions(currentYear)]}
      {...yearProps}
    />
  </Group>
);

export default ExpirationFields;
