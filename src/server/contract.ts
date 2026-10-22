import type { BranchReport } from '../branches/report.ts';

/** A value after `JSON.stringify` and `JSON.parse`: dates become ISO 8601 strings. */
export type Serialized<T> = T extends Date
  ? string
  : T extends readonly (infer Item)[]
    ? readonly Serialized<Item>[]
    : T extends object
      ? { readonly [Key in keyof T]: Serialized<T[Key]> }
      : T;

/** Body of a successful `GET /api/branches` response. */
export type BranchReportResponse = Serialized<BranchReport>;

/** Body of every failed API response. */
export interface ApiErrorResponse {
  readonly error: string;
}

/** Body of `GET /api/quota`: the visitor's daily allowance (ADR 0008). */
export interface QuotaResponse {
  /** The maintainer, signed in with the owner key. */
  readonly owner: boolean;
  /** Null when there is no allowance: for the owner, or when it is disabled. */
  readonly limit: number | null;
  readonly remaining: number | null;
  /** ISO 8601; null while nothing has been used. */
  readonly resetsAt: string | null;
}
