import type { TextInputProps } from "@mantine/core";
import { TextInput } from "@mantine/core";
import type { ChangeEvent } from "react";
import { useLayoutEffect, useRef } from "react";

const DIGITS = 16;
const GROUP = 4;

const digitsIn = (value: string) => value.replace(/\D/g, "");

const formatCardNumber = (digits: string) => digits.match(/\d{1,4}/g)?.join("-") ?? "";

const caretAfter = (digits: number) => digits + Math.max(0, Math.floor((digits - 1) / GROUP));

type CardNumberInputProps = Omit<TextInputProps, "value" | "onChange"> & {
  value: string;
  onChange: (value: string) => void;
};

const CardNumberInput = ({ value, onChange, ...props }: CardNumberInputProps) => {
  const input = useRef<HTMLInputElement>(null);
  const caret = useRef<number>(undefined);

  useLayoutEffect(() => {
    if (caret.current !== undefined && input.current && input.current === document.activeElement) {
      input.current.setSelectionRange(caret.current, caret.current);
    }
    caret.current = undefined;
  });

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { value: raw, selectionStart } = event.currentTarget;
    const { inputType } = event.nativeEvent as InputEvent;
    let digits = digitsIn(raw);
    let before = digitsIn(raw.slice(0, selectionStart ?? raw.length)).length;

    if (digits === digitsIn(value) && raw.length < value.length) {
      if (inputType === "deleteContentBackward" && before > 0) {
        digits = digits.slice(0, before - 1) + digits.slice(before);
        before -= 1;
      } else if (inputType === "deleteContentForward") {
        digits = digits.slice(0, before) + digits.slice(before + 1);
      }
    }

    digits = digits.slice(0, DIGITS);
    caret.current = caretAfter(Math.min(before, digits.length));
    onChange(formatCardNumber(digits));
  };

  return (
    <TextInput
      {...props}
      ref={input}
      value={value}
      onChange={handleChange}
      inputMode="numeric"
      autoComplete="cc-number"
      maxLength={DIGITS + DIGITS / GROUP - 1}
    />
  );
};

export default CardNumberInput;
