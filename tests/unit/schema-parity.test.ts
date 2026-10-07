import Ajv2020 from 'ajv/dist/2020';
import { describe, expect, it } from 'vitest';
import inputsJsonSchema from '../../spec/inputs.schema.json';
import vectors from '../../spec/test_vectors.json';
import { InputsSchema } from '@/domain/chronosleep';

const ajv = new Ajv2020({ strict: false, allErrors: true });
// `unit`, `help`, `default`, `where_to_find` are annotations in the spec; ajv strict=false ignores them.
const validateJson = ajv.compile(inputsJsonSchema);

const good = vectors[0]!.inputs;

const mutations: Record<string, Record<string, unknown>> = {
  ok: { ...good },
  time_24: { ...good, work_bedtime: '24:00' },
  time_short: { ...good, work_bedtime: '9:00' },
  time_minutes: { ...good, free_wake_time: '07:60' },
  latency_121: { ...good, sleep_latency_min: 121 },
  latency_neg: { ...good, sleep_latency_min: -1 },
  latency_float: { ...good, sleep_latency_min: 15.5 },
  workdays_0: { ...good, workdays_per_week: 0 },
  workdays_7: { ...good, workdays_per_week: 7 },
  flex_121: { ...good, wake_flexibility_min: 121 },
  flex_45: { ...good, wake_flexibility_min: 45 },
  flex_str: { ...good, wake_flexibility_min: '30' },
  alarm_str: { ...good, free_day_alarm: 'false' },
  extra_key: { ...good, name: 'x' },
  missing_key: (({ free_bedtime: _f, ...rest }) => rest)(good),
};

describe('Zod contract == spec/inputs.schema.json (AT-03)', () => {
  for (const [name, input] of Object.entries(mutations)) {
    it(`agrees on "${name}"`, () => {
      const zodOk = InputsSchema.safeParse(input).success;
      const jsonOk = validateJson(input) as boolean;
      expect(zodOk).toBe(jsonOk);
    });
  }

  it('accepts every official vector input', () => {
    for (const v of vectors) {
      expect(InputsSchema.safeParse(v.inputs).success).toBe(true);
      expect(validateJson(v.inputs)).toBe(true);
    }
  });
});
