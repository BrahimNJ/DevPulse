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
