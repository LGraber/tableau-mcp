/* data app library prototype -- Tableau adapter; imports ./data-app.js */
var __defProp = Object.defineProperty;
var __typeError = (msg) => {
  throw TypeError(msg);
};
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
var __accessCheck = (obj, member, msg) => member.has(obj) || __typeError("Cannot " + msg);
var __privateGet = (obj, member, getter) => (__accessCheck(obj, member, "read from private field"), getter ? getter.call(obj) : member.get(obj));
var __privateAdd = (obj, member, value) => member.has(obj) ? __typeError("Cannot add the same private member more than once") : member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
var __privateSet = (obj, member, value, setter) => (__accessCheck(obj, member, "write to private field"), setter ? setter.call(obj, value) : member.set(obj, value), value);
var __privateMethod = (obj, member, method) => (__accessCheck(obj, member, "access private method"), method);

// src/providers/tableau/index.ts
import { createDataApp as createCoreApp } from "./data-app.js";
import {
  DataAppError,
  invalidTemplate
} from "./data-app.js";

// src/providers/tableau/hbi.ts
var isObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
var hbiDialect = {
  name: "hbi",
  elementArrays: ["fields", "filters", "parameters", "sets"],
  refSections: ["filters", "sets"],
  callOptions: ["debug", "returnFormat", "bypassMetadataCache"],
  checkTemplate(queryId, template, invalid) {
    if (!Array.isArray(template.fields)) throw invalid(`query ${queryId} needs query.fields`);
  },
  resultColumns(template) {
    if (!Array.isArray(template.fields)) return void 0;
    const columns = [];
    for (const field of template.fields) {
      if (!isObject(field)) return void 0;
      if (typeof field.fieldAlias === "string") columns.push(field.fieldAlias);
      else if (typeof field.fieldCaption !== "string") return void 0;
      else {
        columns.push(field.fieldCaption);
        if (typeof field.function === "string") columns.push(`${field.function}(${field.fieldCaption})`);
      }
    }
    return columns;
  },
  checkExpansion(_queryId, query, invalid) {
    const fields = query.fields;
    if (!Array.isArray(fields) || fields.length === 0) throw invalid("query.fields", "every field was omitted");
    fields.forEach((field, i) => {
      if (!isObject(field) || typeof field.fieldCaption !== "string") {
        throw invalid(`query.fields[${i}]`, "a field needs a string fieldCaption after substitution");
      }
    });
  }
};

// src/providers/tableau/index.ts
var DATA_TYPES = /* @__PURE__ */ new Set(["STRING", "INTEGER", "REAL", "BOOLEAN", "DATE", "DATETIME"]);
function readEnvironment(tableau) {
  try {
    return tableau?.extensions?.environment;
  } catch {
    return void 0;
  }
}
var _dataSources, _TableauProvider_instances, fields_fn, find_fn, incompatible_fn, listDataSources_fn;
var TableauProvider = class {
  constructor(tableau, sendAttribution) {
    __publicField(this, "tableau", tableau);
    __publicField(this, "sendAttribution", sendAttribution);
    __privateAdd(this, _TableauProvider_instances);
    __publicField(this, "dialect", hbiDialect);
    __privateAdd(this, _dataSources);
  }
  async query(request) {
    const dataSource = await __privateMethod(this, _TableauProvider_instances, find_fn).call(this, request.datasource, request.queryId);
    if (typeof dataSource.queryAsync !== "function") throw __privateMethod(this, _TableauProvider_instances, incompatible_fn).call(this, "queryAsync");
    if (!this.sendAttribution) return dataSource.queryAsync(request.query, request.options);
    return dataSource.queryAsync(request.query, request.options, { attribution: request.attribution });
  }
  async datasourceMetadata(datasource) {
    const dataSource = await __privateMethod(this, _TableauProvider_instances, find_fn).call(this, datasource);
    if (typeof dataSource.readMetadataAsync !== "function") throw __privateMethod(this, _TableauProvider_instances, incompatible_fn).call(this, "readMetadataAsync");
    const response = await dataSource.readMetadataAsync();
    return { fields: __privateMethod(this, _TableauProvider_instances, fields_fn).call(this, response.data ?? []) };
  }
};
_dataSources = new WeakMap();
_TableauProvider_instances = new WeakSet();
fields_fn = function(metadata) {
  return metadata.flatMap(
    (f) => typeof f.fieldCaption === "string" ? [
      {
        caption: f.fieldCaption,
        ...DATA_TYPES.has(f.dataType ?? "") && { dataType: f.dataType },
        ...typeof f.description === "string" && f.description !== "" && { description: f.description }
      }
    ] : []
  );
};
find_fn = async function(datasource, queryId) {
  const datasourceId = datasource.datasourceId;
  if (!datasourceId) {
    const reason = `datasource ${datasource.id} has no datasourceId`;
    throw queryId ? invalidTemplate(queryId, "datasource", reason) : new DataAppError("DATASOURCE_NOT_FOUND", reason);
  }
  const dataSource = (await __privateMethod(this, _TableauProvider_instances, listDataSources_fn).call(this)).find((d) => d.id === datasourceId || d.name === datasourceId);
  if (!dataSource) {
    throw new DataAppError("DATASOURCE_NOT_FOUND", `no datasource ${datasourceId}${queryId ? ` for query ${queryId}` : ""}`, {
      ...queryId && { queryId }
    });
  }
  return dataSource;
};
incompatible_fn = function(method) {
  const apiVersion = readEnvironment(this.tableau)?.apiVersion;
  return new DataAppError("INCOMPATIBLE_HOST_API", `DataSource.${method} is unavailable (Extensions API ${apiVersion ?? "unknown"})`, { apiVersion });
};
listDataSources_fn = function() {
  __privateGet(this, _dataSources) ?? __privateSet(this, _dataSources, (async () => {
    const ext = this.tableau.extensions;
    if (typeof ext.workbook?.getAllDataSourcesAsync === "function") return ext.workbook.getAllDataSourcesAsync();
    const worksheets = ext.worksheetContent ? [ext.worksheetContent.worksheet] : ext.dashboardContent?.dashboard.worksheets ?? [];
    const lists = await Promise.all(worksheets.map((w) => w.getDataSourcesAsync()));
    const byId = /* @__PURE__ */ new Map();
    for (const ds of lists.flat()) if (!byId.has(ds.id)) byId.set(ds.id, ds);
    return [...byId.values()];
  })());
  __privateGet(this, _dataSources).catch(() => __privateSet(this, _dataSources, void 0));
  return __privateGet(this, _dataSources);
};
function tableauAdapter(tableau = globalThis.tableau) {
  if (!tableau || !readEnvironment(tableau)) {
    throw new DataAppError("NOT_INITIALIZED", "call tableau.extensions.initializeAsync() before createDataApp()");
  }
  const primitives = tableau.extensions.hostPrimitives;
  const host = primitives && typeof primitives.reportState === "function" && typeof primitives.onRequest === "function" ? hostChannel(primitives) : void 0;
  if (!host) {
    console.warn(
      "[data-app] Extensions API host primitives are unavailable; custom views, agent writes, persistence and query attribution are disabled."
    );
  }
  return { provider: new TableauProvider(tableau, host !== void 0), ...host && { host } };
}
function hostChannel(primitives) {
  return {
    initialSnapshot: primitives.initialState,
    packageId: primitives.packageId,
    packageVersion: primitives.packageVersion,
    reportState: (message) => primitives.reportState(message),
    onRequest: (handler) => primitives.onRequest(handler),
    ...primitives.reportTelemetry && { reportTelemetry: (event) => primitives.reportTelemetry(event) },
    ...primitives.reportInspecting && { reportInspecting: (inspecting) => primitives.reportInspecting(inspecting) }
  };
}
async function createDataApp(options = {}) {
  const { tableau = globalThis.tableau, ...rest } = options;
  const now = rest.now ?? Date.now;
  const startedAt = rest.startedAt ?? now();
  const spans = [...rest.spans ?? []];
  if (tableau && !readEnvironment(tableau) && typeof tableau.extensions?.initializeAsync === "function") {
    const initStart = now();
    await tableau.extensions.initializeAsync();
    spans.push({ name: "host.initialize", startedAt: initStart, at: now() });
  }
  return createCoreApp({ ...rest, ...tableauAdapter(tableau), startedAt, spans });
}
export {
  createDataApp,
  hbiDialect,
  tableauAdapter
};
