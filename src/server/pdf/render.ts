import 'server-only';
import { renderToBuffer } from '@react-pdf/renderer';
import { createElement } from 'react';
import { createTranslator } from 'use-intl/core';
import { verificationIdFromUuid, type FormatLocale, type ReportModel } from '@/domain/chronosleep';
import { getMessages } from '@/messages';
import { appOrigin } from '../env';
import { sha256Hex } from '../crypto';
import { ReportDocument, type T } from './ReportDocument';

export function makeTranslator(locale: FormatLocale): T {
  return createTranslator({ locale, messages: getMessages(locale) as never }) as unknown as T;
}

/** Fingerprint of the report payload (no email): first 16 hex chars of SHA-256. */
export function reportHash(report: ReportModel): string {
  return sha256Hex(
    JSON.stringify({ m: report.model_version, v: report.report_version, i: report.inputs, r: report.result }),
  ).slice(0, 16);
}

export interface RenderedPdf {
  bytes: Uint8Array;
  sha256: string;
  verificationId: string;
}

/** FR-09/FR-32: renders the full report PDF with @react-pdf/renderer from the shared ReportModel. */
export async function renderReportPdf(args: {
  report: ReportModel;
  locale: FormatLocale;
  /** Lead (or calculation) UUID used to derive the opaque verification id. */
  entityId: string;
  generatedAt?: Date;
}): Promise<RenderedPdf> {
  const verificationId = verificationIdFromUuid(args.entityId);
  const prefix = args.locale === 'es' ? '' : `/${args.locale}`;
  const buffer = await renderToBuffer(
    createElement(ReportDocument, {
      report: args.report,
      locale: args.locale,
      t: makeTranslator(args.locale),
      verificationId,
      generatedAt: args.generatedAt ?? new Date(),
      reportHash: reportHash(args.report),
      privacyUrl: `${appOrigin()}${prefix}/legal/privacidad`,
    }) as never,
  );
  const bytes = new Uint8Array(buffer);
  return { bytes, sha256: sha256Hex(bytes), verificationId };
}
