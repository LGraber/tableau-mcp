---
sidebar_position: 4
---

# Upload Data File

Uploads a delimited text data file (`.csv`, `.tsv`, `.txt`, `.tab`, `.txn`) for ad-hoc analysis
without publishing a data source. The returned `fileUpload` object can be passed to
[Get Datasource Metadata](get-datasource-metadata.md) and [Query Datasource](query-datasource.md)
in place of `datasourceLuid`.

This tool is available when the `adhoc-file-upload` feature is enabled.

## APIs called

- [Initiate File Upload](https://help.tableau.com/current/api/rest_api/en-us/REST/rest_api_ref_publishing.htm#initiate_file_upload)
- [Append to File Upload](https://help.tableau.com/current/api/rest_api/en-us/REST/rest_api_ref_publishing.htm#append_to_file_upload)

## Optional arguments

Provide exactly one of `filePath` or `content`.

### `filePath`

Absolute path to a local data file. Only supported when the MCP server runs locally and staged S3
uploads (`MCP_S3_BUCKET`) are not configured.

<hr />

### `content`

The full text content of the data file.

<hr />

### `fileName`

The file name including extension. Required with `content`; defaults to the base name of
`filePath`.

<hr />

### `textOptions`

How to parse the file: `separator`, `hasHeader`, `characterSet`, `textQualifier`, `locale`. Omit to
let Tableau infer them.

## Example result

```json
{
  "fileUpload": {
    "uploadId": "9:3F2A1B7C8D4E4F5A9B6C1D2E3F4A5B6C-1:0",
    "fileType": "TEXT",
    "fileName": "sales.csv"
  },
  "fileSize": 52311
}
```

The upload is private to the calling user and expires after a period of inactivity. Reuse the same
`fileUpload` for every metadata and query call; if a call reports the upload was not found, upload
the file again.
