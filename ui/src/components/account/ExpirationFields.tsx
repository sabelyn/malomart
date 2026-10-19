import { Group, NativeSelect } from "@mantine/core";
import type { GetInputPropsReturnType } from "@mantine/form";
import { isCardExpired } from "@mm/lib/customers";
import { string } from "zod";

import { alerts, ui } from "@/copy";

const YEARS_AHEAD = 15;

export const expirationFields = {
  expirationMonth: string().nonempty({ error: alerts.cards.chooseMonth }).transform(Number),
  expirationYear: string().nonempty({ error: alerts.cards.chooseYear }).transform(Number)
};

export const notExpired = (value: { expirationMonth: number; expirationYear: number }) => !isCardExpired(value);

export const expiredIssue = { error: alerts.cards.expired, path: ["expirationYear"] };

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
      label={ui.cards.expirationMonth}
      autoComplete="cc-exp-month"
      required
      data-autofocus={autoFocus || undefined}
      data={[{ value: "", label: ui.cards.month, disabled: true }, ...MONTHS]}
      {...monthProps}
    />
    <NativeSelect
      label={ui.cards.expirationYear}
      autoComplete="cc-exp-year"
      required
      data={[{ value: "", label: ui.cards.year, disabled: true }, ...yearOptions(currentYear)]}
      {...yearProps}
    />
  </Group>
);

export default ExpirationFields;
