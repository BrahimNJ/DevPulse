import type { JSX } from 'react';

import { exportBlob, exportFileName, saveFile, type ExportFormat } from './export-file.ts';
import { useI18n } from './I18nProvider.tsx';
import { DownloadIcon } from './icons.tsx';

/**
 * Downloads the report on screen. Each format is built only when asked for, from the
 * report the page already holds; a report without a CSV form offers Markdown alone.
 */
export function ExportControl({
  repository,
  report,
  generatedAt,
  markdown,
  csv,
}: {
  readonly repository: string;
  /** Names the report in the file name, such as `branches`. */
  readonly report: string;
  readonly generatedAt: string;
  readonly markdown: () => string;
  readonly csv?: () => string;
}): JSX.Element {
  const { t } = useI18n();

  function download(format: ExportFormat, content: string): void {
    saveFile(exportBlob(content, format), exportFileName(repository, report, generatedAt, format));
  }

  return (
    <div className="export-control" role="group" aria-label={t.export.groupLabel}>
      <span className="export-label" aria-hidden="true">
        <DownloadIcon />
        {t.export.label}
      </span>
      <button
        type="button"
        className="button button-ghost button-small"
        title={t.export.markdownHint}
        onClick={() => {
          download('markdown', markdown());
        }}
      >
        {t.export.markdown}
      </button>
      {csv !== undefined && (
        <button
          type="button"
          className="button button-ghost button-small"
          title={t.export.csvHint}
          onClick={() => {
            download('csv', csv());
          }}
        >
          {t.export.csv}
        </button>
      )}
    </div>
  );
}
