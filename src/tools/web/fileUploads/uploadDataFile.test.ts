import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

import { WebMcpServer } from '../../../server.web.js';
import { stubDefaultEnvVars } from '../../../testShared.js';
import invariant from '../../../utils/invariant.js';
import { Provider } from '../../../utils/provider.js';
import { getMockRequestHandlerExtra } from '../toolContext.mock.js';
import { getUploadDataFileTool } from './uploadDataFile.js';

const mocks = vi.hoisted(() => ({
  mockIsFeatureEnabled: vi.fn(),
  mockUploadFileInChunks: vi.fn(),
}));

vi.mock('../../../features/init.js', () => ({
  getFeatureGate: vi.fn(() => ({ isFeatureEnabled: mocks.mockIsFeatureEnabled })),
}));

vi.mock('../../../restApiInstance.js', () => ({
  useRestApi: vi.fn().mockImplementation(async ({ callback }) =>
    callback({
      siteId: 'test-site-id',
      publishingMethods: { uploadFileInChunks: mocks.mockUploadFileInChunks },
    }),
  ),
}));

type Args = {
  filePath?: string;
  content?: string;
  fileName?: string;
  textOptions?: { separator?: string; hasHeader?: boolean };
};

async function callTool(args: Args): Promise<CallToolResult> {
  const tool = getUploadDataFileTool(new WebMcpServer());
  const callback = await Provider.from(tool.callback);
  return await callback(
    {
      filePath: args.filePath,
      content: args.content,
      fileName: args.fileName,
      textOptions: args.textOptions,
    },
    getMockRequestHandlerExtra(),
  );
}

function getText(result: CallToolResult): string {
  invariant(result.content[0].type === 'text');
  return result.content[0].text;
}

describe('uploadDataFileTool', () => {
  let tempDir: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    stubDefaultEnvVars();
    mocks.mockIsFeatureEnabled.mockResolvedValue(true);
    mocks.mockUploadFileInChunks.mockResolvedValue('9:upload-id');
    tempDir = await mkdtemp(join(tmpdir(), 'upload-data-file-'));
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await rm(tempDir, { recursive: true, force: true });
  });

  it('is disabled when the adhoc-file-upload feature is off', async () => {
    mocks.mockIsFeatureEnabled.mockResolvedValue(false);
    const tool = getUploadDataFileTool(new WebMcpServer());
    expect(await Provider.from(tool.disabled)).toBe(true);
  });

  it('uploads inline content and returns a fileUpload descriptor', async () => {
    const result = await callTool({
      content: 'a,b\n1,2\n',
      fileName: 'sales.csv',
      textOptions: { separator: ',', hasHeader: true },
    });

    expect(result.isError).toBe(false);
    expect(mocks.mockUploadFileInChunks).toHaveBeenCalledWith({
      siteId: 'test-site-id',
      filename: 'sales.csv',
      content: Buffer.from('a,b\n1,2\n'),
    });
    expect(JSON.parse(getText(result))).toEqual({
      fileUpload: {
        uploadId: '9:upload-id',
        fileType: 'TEXT',
        fileName: 'sales.csv',
        textOptions: { separator: ',', hasHeader: true },
      },
      fileSize: 8,
    });
  });

  it('uploads a local file and defaults fileName to its base name', async () => {
    const filePath = join(tempDir, 'orders.tsv');
    await writeFile(filePath, 'x\ty\n1\t2\n');

    const result = await callTool({ filePath });

    expect(result.isError).toBe(false);
    expect(mocks.mockUploadFileInChunks).toHaveBeenCalledWith(
      expect.objectContaining({ filename: 'orders.tsv' }),
    );
    expect(JSON.parse(getText(result)).fileUpload).toEqual({
      uploadId: '9:upload-id',
      fileType: 'TEXT',
      fileName: 'orders.tsv',
    });
  });

  it('rejects unsupported extensions', async () => {
    const result = await callTool({ content: 'x', fileName: 'data.xlsx' });

    expect(result.isError).toBe(true);
    expect(getText(result)).toContain('fileName must end in one of');
    expect(mocks.mockUploadFileInChunks).not.toHaveBeenCalled();
  });

  it('rejects empty content', async () => {
    const result = await callTool({ content: '', fileName: 'data.csv' });

    expect(result.isError).toBe(true);
    expect(getText(result)).toBe('The data file must not be empty.');
  });

  it('requires fileName with content', async () => {
    const result = await callTool({ content: 'a\n1\n' });

    expect(result.isError).toBe(true);
    expect(getText(result)).toBe('fileName is required when content is provided.');
  });

  it('rejects both filePath and content', async () => {
    const result = await callTool({ filePath: '/tmp/a.csv', content: 'a', fileName: 'a.csv' });

    expect(result.isError).toBe(true);
    expect(getText(result)).toBe('Provide either filePath or content, not both.');
  });

  it('requires filePath or content', async () => {
    const result = await callTool({});

    expect(result.isError).toBe(true);
    expect(getText(result)).toBe('Either filePath or content must be provided.');
  });

  it('rejects filePath when staged S3 uploads are configured', async () => {
    vi.stubEnv('MCP_S3_BUCKET', 'test-bucket');
    const filePath = join(tempDir, 'orders.csv');
    await writeFile(filePath, 'a\n1\n');

    const result = await callTool({ filePath });

    expect(result.isError).toBe(true);
    expect(getText(result)).toContain('filePath is not supported by this MCP server');
  });
});
