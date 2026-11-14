import { getFeatureGate } from '../../../features/init.js';
import {
  Datasource,
  FileUploadSource,
  fileUploadSourceSchema,
} from '../../../sdks/tableau/apis/vizqlDataServiceApi.js';

export const ADHOC_FILE_UPLOAD_FEATURE = 'adhoc-file-upload';

export const fileUploadParamSchema = fileUploadSourceSchema
  .optional()
  .describe(
    'An uploaded data file to analyze instead of a published data source. Pass the fileUpload object returned by upload-data-file verbatim. Mutually exclusive with datasourceLuid.',
  );

export const FILE_UPLOAD_DESCRIPTION_SUFFIX = `

    To analyze an ad-hoc data file that is not published to Tableau, first call upload-data-file and then pass its returned fileUpload object here instead of datasourceLuid. Provide exactly one of datasourceLuid or fileUpload. Each call re-reads the uploaded file, so reuse the same fileUpload for every metadata and query call against that file.`;

export async function isAdhocFileUploadEnabled(): Promise<boolean> {
  return await getFeatureGate().isFeatureEnabled(ADHOC_FILE_UPLOAD_FEATURE);
}

export type DatasourceTarget =
  | { kind: 'published'; datasourceLuid: string }
  | { kind: 'fileUpload'; fileUpload: FileUploadSource };

export function resolveDatasourceTarget({
  datasourceLuid,
  fileUpload,
}: {
  datasourceLuid?: string;
  fileUpload?: FileUploadSource;
}): DatasourceTarget {
  if (datasourceLuid && fileUpload) {
    throw new Error('Provide either datasourceLuid or fileUpload, not both.');
  }
  if (fileUpload) {
    return { kind: 'fileUpload', fileUpload };
  }
  if (!datasourceLuid) {
    throw new Error('datasourceLuid must be a non-empty string.');
  }
  return { kind: 'published', datasourceLuid };
}

export function toVdsDatasource(target: DatasourceTarget): Datasource {
  return target.kind === 'fileUpload'
    ? { fileUpload: target.fileUpload }
    : { datasourceLuid: target.datasourceLuid };
}
