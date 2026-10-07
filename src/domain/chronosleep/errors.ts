export type EngineErrorCode =
  | 'missing_inputs'
  | 'invalid_time'
  | 'invalid_boolean'
  | 'invalid_integer'
  | 'out_of_range'
  | 'sleep_duration_work'
  | 'sleep_duration_free';

/** Domain error raised for any input the model refuses to process (abstention). */
export class EngineError extends Error {
  readonly code: EngineErrorCode;
  readonly field?: string;
  /** For duration errors: the implied sleep episode (hours). */
  readonly hours?: number;

  constructor(code: EngineErrorCode, message: string, extra: { field?: string; hours?: number } = {}) {
    super(message);
    this.name = 'EngineError';
    this.code = code;
    this.field = extra.field;
    this.hours = extra.hours;
  }
}
