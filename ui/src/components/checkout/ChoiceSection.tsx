import { Button, Radio, Text, Title, VisuallyHidden } from "@mantine/core";
import type { ReactNode, Ref } from "react";

import MaloSays from "@/components/MaloSays";
import PageLoader from "@/components/PageLoader";
import classes from "./checkout.module.css";

export type Choice = {
  id: string;
  label: ReactNode;
  description: ReactNode;
  disabled?: boolean;
};

type ChoiceSectionProps = {
  ref?: Ref<HTMLElement>;
  id: string;
  title: string;
  groupLabel: string;
  choices: Choice[] | undefined;
  isPending: boolean;
  loadFailedMessage: string;
  emptyMessage: string;
  addLabel: string;
  value: string | null;
  error?: string;
  status: string;
  note?: ReactNode;
  onRetry: () => void;
  onAdd: () => void;
  onChange: (id: string) => void;
};

const ChoiceSection = ({
  ref,
  id,
  title,
  groupLabel,
  choices,
  isPending,
  loadFailedMessage,
  emptyMessage,
  addLabel,
  value,
  error,
  status,
  note,
  onRetry,
  onAdd,
  onChange
}: ChoiceSectionProps) => {
  const headingId = `${id}-heading`;
  const errorId = `${id}-error`;

  const renderContent = () => {
    if (isPending) {
      return <PageLoader />;
    }
    if (!choices) {
      return (
        <div role="alert">
          <MaloSays>{loadFailedMessage}</MaloSays>
          <Button mt="lg" variant="outline" onClick={onRetry}>
            Try again
          </Button>
        </div>
      );
    }
    if (choices.length === 0) {
      return (
        <>
          <MaloSays>{emptyMessage}</MaloSays>
          {error && (
            <Text id={errorId} className={classes.error} mt="md">
              {error}
            </Text>
          )}
        </>
      );
    }
    return (
      <Radio.Group
        label={<VisuallyHidden>{groupLabel}</VisuallyHidden>}
        labelProps={{ "aria-hidden": true }}
        value={value}
        error={error}
        onChange={onChange}
      >
        <div className={classes.choices}>
          {choices.map(choice => (
            <Radio
              key={choice.id}
              value={choice.id}
              label={choice.label}
              description={choice.description}
              disabled={choice.disabled}
              mod={{ disabled: choice.disabled }}
              classNames={{ root: classes.choice, label: classes.choiceLabel, description: classes.choiceDescription }}
            />
          ))}
        </div>
        {note && <Text className={classes.note}>{note}</Text>}
      </Radio.Group>
    );
  };

  return (
    <section ref={ref} aria-labelledby={headingId}>
      <div className={classes.sectionHeader}>
        <Title order={2} id={headingId} className={classes.sectionTitle}>
          {title}
        </Title>
        <Button
          variant={choices?.length === 0 ? "filled" : "outline"}
          size="sm"
          aria-describedby={choices?.length === 0 && error ? errorId : undefined}
          onClick={onAdd}
        >
          {addLabel}
        </Button>
      </div>
      <Text role="status" className={classes.status}>
        {status}
      </Text>
      {renderContent()}
    </section>
  );
};

export default ChoiceSection;
