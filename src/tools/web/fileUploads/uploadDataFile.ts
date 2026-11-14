import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { readFile, stat } from 'fs/promises';
import { basename, extname } from 'path';
import { Ok } from 'ts-results-es';
import { z } from 'zod';

import { ArgsValidationError } from '../../../errors/mcpToolError.js';
import { useRestApi } from '../../../restApiInstance.js';
import {
  FileUploadSource,
  textFileOptionsSchema,
} from '../../../sdks/tableau/apis/vizqlDataServiceApi.js';
import { SiteRole } from '../../../sdks/tableau/types/user.js';
import { WebMcpServer } from '../../../server.web.js';
import { Provider } from '../../../utils/provider.js';
import { WebTool } from '../tool.js';
import { isAdhocFileUploadEnabled } from './fileUploadDatasource.js';

export const ALLOWED_TEXT_FILE_EXTENSIONS = ['csv', 'tsv', 'txt', 'tab', 'txn'] as const;
export const MAX_DATA_FILE_BYTES = 256 * 1024 * 1024;

const paramsSchema = {
  filePath: z
    .string()
    .min(1)
    .optional()
    .describe(
      'Absolute path to a local text data file. Only supported when the MCP server runs locally and staged S3 uploads are not configured.',
    ),
  content: z
    .string()
    .optional()
    .describe('The full text content of the data file. Use when filePath is not available.'),
  fileName: z
    .string()
    .min(1)
    .optional()
    .describe(
      `File name including extension (${ALLOWED_TEXT_FILE_EXTENSIONS.join(', ')}). Required with content; defaults to the base name of filePath.`,
    ),
  textOptions: textFileOptionsSchema
    .optional()
    .describe(
      'How to parse the file. Omit to let Tableau infer the separator, header, and character set.',
    ),
};

export type UploadDataFileResult = {
  fileUpload: FileUploadSource;
  fileSize: number;
};

export const getUploadDataFileTool = (server: WebMcpServer): WebTool<typeof paramsSchema> => {
  const tool = new WebTool({
    server,
    name: 'upload-data-file',
    minRequiredRole: SiteRole.VIEWER,
    description: `Uploads a delimited text data file (${ALLOWED_TEXT_FILE_EXTENSIONS.join(', ')}) to Tableau for ad-hoc analysis without publishing a data source. Returns a fileUpload object; pass it verbatim as the fileUpload argument of get-datasource-metadata and query-datasource instead of datasourceLuid. The upload is private to the calling user and expires after a period of inactivity; if a later call reports the upload was not found, upload the file again.`,
    paramsSchema,
    annotations: {
      title: 'Upload Data File',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    disabled: new Provider(async () => !(await isAdhocFileUploadEnabled())),
    callback: async (
      { filePath, content, fileName, textOptions },
      extra,
    ): Promise<CallToolResult> => {
      return await tool.logAndExecute<UploadDataFileResult>({
        extra,
        args: { filePath, fileName, textOptions },
        callback: async () => {
          let file: { fileName: string; bytes: Buffer };
          try {
            file = await resolveDataFile({
              filePath,
              content,
              fileName,
              localFilesAllowed: !extra.config.bucketS3.enabled,
            });
          } catch (error) {
            if (error instanceof ArgsValidationError) {
              return error.toErr();
            }
            throw error;
          }

          return await useRestApi({
            ...extra,
            jwtScopes: tool.requiredApiScopes,
            callback: async (restApi) => {
              const uploadId = await restApi.publishingMethods.uploadFileInChunks({
                siteId: restApi.siteId,
                filename: file.fileName,
                content: file.bytes,
              });
              return new Ok({
                fileUpload: {
                  uploadId,
                  fileType: 'TEXT' as const,
                  fileName: file.fileName,
                  ...(textOptions ? { textOptions } : {}),
                },
                fileSize: file.bytes.byteLength,
              });
            },
          });
        },
        constrainSuccessResult: (result) => ({ type: 'success', result }),
      });
    },
  });

  return tool;
};

async function resolveDataFile({
  filePath,
  content,
  fileName,
  localFilesAllowed,
}: {
  filePath?: string;
  content?: string;
  fileName?: string;
  localFilesAllowed: boolean;
}): Promise<{ fileName: string; bytes: Buffer }> {
  if (filePath && content !== undefined) {
    throw new ArgsValidationError('Provide either filePath or content, not both.');
  }

  let bytes: Buffer;
  let resolvedName: string;
  if (filePath) {
    if (!localFilesAllowed) {
      throw new ArgsValidationError(
        'filePath is not supported by this MCP server. Pass the file text as content with a fileName instead.',
      );
    }
    resolvedName = fileName ?? basename(filePath);
    validateExtension(resolvedName);
    const { size } = await stat(filePath);
    assertSize(size);
    bytes = await readFile(filePath);
  } else if (content !== undefined) {
    if (!fileName) {
      throw new ArgsValidationError('fileName is required when content is provided.');
    }
    resolvedName = fileName;
    validateExtension(resolvedName);
    bytes = Buffer.from(content, 'utf8');
    assertSize(bytes.byteLength);
  } else {
    throw new ArgsValidationError('Either filePath or content must be provided.');
  }

  return { fileName: resolvedName, bytes };
}

function validateExtension(fileName: string): void {
  const extension = extname(fileName).slice(1).toLowerCase();
  if (!(ALLOWED_TEXT_FILE_EXTENSIONS as ReadonlyArray<string>).includes(extension)) {
    throw new ArgsValidationError(
      `fileName must end in one of: ${ALLOWED_TEXT_FILE_EXTENSIONS.map((e) => `.${e}`).join(', ')}.`,
    );
  }
}

function assertSize(size: number): void {
  if (size === 0) {
    throw new ArgsValidationError('The data file must not be empty.');
  }
  if (size > MAX_DATA_FILE_BYTES) {
    throw new ArgsValidationError(
      `The data file is ${size} bytes, which exceeds the ${MAX_DATA_FILE_BYTES}-byte limit.`,
    );
  }
}
