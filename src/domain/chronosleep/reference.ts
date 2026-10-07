import type { ReferenceBand } from './types';

/**
 * Descriptive population reference (NHANES 2017–2020, US adults 20+).
 * Source rows live in `drive/base/base_chronosleep.xlsx` (Parametros + Tablas_Referencia_SJL);
 * parity is asserted in tests/unit/base-xlsx.test.ts. Never a clinical threshold.
 */
export const POPULATION_REFERENCE = {
  label: 'NHANES 2017–2020',
  country: 'US',
  mean_sjl_hours: 1.1,
  prevalence_ge_1h: 0.465,
  prevalence_ge_2h: 0.193,
  source_url: 'https://jamanetwork.com/journals/jamanetworkopen/fullarticle/2798209',
} as const;

export interface BandShare {
  band: ReferenceBand;
  /** Share of US adults in this band (rounded to 0.1 pp). */
  share: number;
}

/** Simplified descriptive distribution derived from the two published prevalences. */
export function populationBands(): BandShare[] {
  const lt1 = 1 - POPULATION_REFERENCE.prevalence_ge_1h;
  const mid = POPULATION_REFERENCE.prevalence_ge_1h - POPULATION_REFERENCE.prevalence_ge_2h;
  const ge2 = POPULATION_REFERENCE.prevalence_ge_2h;
  const r = (x: number) => Math.round(x * 1000) / 1000;
  return [
    { band: 'menos_de_1h', share: r(lt1) },
    { band: '1h_a_menos_de_2h', share: r(mid) },
    { band: '2h_o_mas', share: r(ge2) },
  ];
}

export const SOURCES = {
  mctq_sjl: 'https://docs.ropensci.org/mctq/reference/sjl.html',
  mctq_msfsc: 'https://docs.ropensci.org/mctq/reference/msf_sc.html',
  mctq_computation: 'https://docs.ropensci.org/mctq/articles/sjl-computation.html',
  mctq_sjlsc: 'https://docs.ropensci.org/mctq/reference/sjl_sc.html',
  msfsc_validation: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5971234/',
  nhanes: 'https://jamanetwork.com/journals/jamanetworkopen/fullarticle/2798209',
  cdc_sleep: 'https://www.cdc.gov/sleep/about/index.html',
} as const;
