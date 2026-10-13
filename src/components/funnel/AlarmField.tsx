'use client';

import { useTranslations } from 'next-intl';
import { Segmented } from './fields';

/** BooleanChoice (UX components): two real radios, no preselection — a factual question needs a conscious answer. */
export function AlarmFieldControl({
  value,
  onChange,
  describedBy,
}: {
  value: 'yes' | 'no' | null;
  onChange: (v: string) => void;
  describedBy?: string;
}) {
  const t = useTranslations('steps.free_day_alarm');
  const w = useTranslations('wizard.fields.free_day_alarm');
  return (
    <Segmented
      name="free_day_alarm"
      legend={w('label')}
      columns={2}
      large
      value={value}
      onChange={onChange}
      describedBy={describedBy}
      options={[
        { value: 'yes', label: t('yes') },
        { value: 'no', label: t('no') },
      ]}
    />
  );
}
