/* data app library prototype -- core */
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
var __privateWrapper = (obj, member, setter, getter) => ({
  set _(value) {
    __privateSet(obj, member, value, setter);
  },
  get _() {
    return __privateGet(obj, member, getter);
  }
});

// src/errors.ts
var DataAppError = class extends Error {
  /** The message is prefixed with the code; `details` are copied onto the error. */
  constructor(code, message, details = {}) {
    super(`${code}: ${message}`, details.cause !== void 0 ? { cause: details.cause } : void 0);
    /** Why the error was thrown. */
    __publicField(this, "code");
    /** The state key involved. */
    __publicField(this, "key");
    /** The named query involved. */
    __publicField(this, "queryId");
    /** Where in the query template the problem is. */
    __publicField(this, "path");
    /** Why, in words. */
    __publicField(this, "reason");
    /** The store's current revision, for REVISION_CONFLICT. */
    __publicField(this, "current");
    /** The host API version, for INCOMPATIBLE_HOST_API. */
    __publicField(this, "apiVersion");
    this.name = "DataAppError";
    this.code = code;
    const { cause: _cause, ...rest } = details;
    Object.assign(this, rest);
  }
};
function invalidState(key, reason) {
  return new DataAppError("INVALID_APP_STATE", `state key ${key}: ${reason}`, { key, reason });
}
function invalidTemplate(queryId, path, reason) {
  return new DataAppError("INVALID_QUERY_TEMPLATE", `query ${queryId} at ${path}: ${reason}`, {
    queryId,
    path,
    reason
  });
}
function unknownStateKey(key) {
  return new DataAppError("UNKNOWN_STATE_KEY", `the manifest declares no state key ${key}`, { key });
}

// src/util.ts
function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function deepEqual(a, b) {
  if (a === b) return true;
  if (Array.isArray(a)) {
    return Array.isArray(b) && a.length === b.length && a.every((x, i) => deepEqual(x, b[i]));
  }
  if (isObject(a) && isObject(b)) {
    const keys = Object.keys(a);
    return keys.length === Object.keys(b).length && keys.every((k) => Object.hasOwn(b, k) && deepEqual(a[k], b[k]));
  }
  return false;
}
function clone(value) {
  if (value === void 0) return value;
  return typeof structuredClone === "function" ? structuredClone(value) : JSON.parse(JSON.stringify(value));
}
var ISO_DATE = /^\d{4}-\d{2}-\d{2}(T.*)?$/;
function compareScalars(a, b) {
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "string" && typeof b === "string") {
    if (ISO_DATE.test(a) && ISO_DATE.test(b)) {
      const pa = Date.parse(a);
      const pb = Date.parse(b);
      if (!Number.isNaN(pa) && !Number.isNaN(pb)) return pa - pb;
    }
    return a < b ? -1 : a > b ? 1 : 0;
  }
  return 0;
}
function format(value) {
  return JSON.stringify(value) ?? String(value);
}

// src/validate.ts
var DATE = /^\d{4}-\d{2}-\d{2}$/;
var DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?$/;
function cardinalityOf(decl) {
  return decl.cardinality ?? "single";
}
var JSON_KEY_LIMIT_BYTES = 64 * 1024;
function behaviorOf(decl) {
  return {
    undo: decl.undo ?? (decl.dataType === "JSON" ? "none" : "step"),
    persist: decl.persist ?? true,
    agents: decl.agents ?? true
  };
}
function jsonSize(value) {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}
function checkJson(value, path = "value") {
  if (value === null || typeof value === "string" || typeof value === "boolean") return void 0;
  if (typeof value === "number") return Number.isFinite(value) ? void 0 : `${path} is not a finite number`;
  if (Array.isArray(value)) {
    for (const [i, item] of value.entries()) {
      const reason = checkJson(item, `${path}[${i}]`);
      if (reason) return reason;
    }
    return void 0;
  }
  if (typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    for (const [key, item] of Object.entries(value)) {
      const reason = checkJson(item, `${path}.${key}`);
      if (reason) return reason;
    }
    return void 0;
  }
  return `${path} is not JSON (${typeof value})`;
}
function memberValue(member) {
  return isObject(member) ? member.value : member;
}
function checkType(type, value) {
  switch (type) {
    case "STRING":
      return typeof value === "string" ? void 0 : `expected a STRING, got ${format(value)}`;
    case "INTEGER":
      return Number.isInteger(value) ? void 0 : `expected an INTEGER, got ${format(value)}`;
    case "REAL":
      return typeof value === "number" && Number.isFinite(value) ? void 0 : `expected a REAL, got ${format(value)}`;
    case "BOOLEAN":
      return typeof value === "boolean" ? void 0 : `expected a BOOLEAN, got ${format(value)}`;
    case "DATE":
      return typeof value === "string" && DATE.test(value) && !Number.isNaN(Date.parse(value)) ? void 0 : `expected a DATE (YYYY-MM-DD), got ${format(value)}`;
    case "DATETIME":
      return typeof value === "string" && DATETIME.test(value) && !Number.isNaN(Date.parse(value)) ? void 0 : `expected an ISO DATETIME, got ${format(value)}`;
  }
}
function checkDomain(decl, type, value) {
  const domain = decl.domain;
  if (!domain) return void 0;
  if (domain.members) {
    return domain.members.some((m) => deepEqual(memberValue(m), value)) ? void 0 : `${format(value)} is not one of the declared members`;
  }
  if (typeof value === "number") {
    if (domain.min !== void 0 && value < domain.min) return `${value} is below the minimum ${domain.min}`;
    if (domain.max !== void 0 && value > domain.max) return `${value} is above the maximum ${domain.max}`;
    if (domain.step !== void 0) {
      const steps = (value - (domain.min ?? 0)) / domain.step;
      if (Math.abs(steps - Math.round(steps)) > 1e-9) return `${value} is not a multiple of the step ${domain.step}`;
    }
  }
  if (typeof value === "string" && (type === "DATE" || type === "DATETIME")) {
    if (domain.minDate !== void 0 && value.slice(0, domain.minDate.length) < domain.minDate) {
      return `${value} is before the minimum date ${domain.minDate}`;
    }
    if (domain.maxDate !== void 0 && value.slice(0, domain.maxDate.length) > domain.maxDate) {
      return `${value} is after the maximum date ${domain.maxDate}`;
    }
  }
  return void 0;
}
function checkScalar(decl, type, value) {
  if (Array.isArray(value) || isObject(value)) return `expected a single value, got ${format(value)}`;
  return checkType(type, value) ?? checkDomain(decl, type, value);
}
function checkStateValue(decl, value) {
  if (decl.dataType === "JSON") {
    const reason = checkJson(value);
    if (reason) return reason;
    const size = jsonSize(value);
    return size > JSON_KEY_LIMIT_BYTES ? `${size} bytes is over the ${JSON_KEY_LIMIT_BYTES}-byte cap for JSON keys` : void 0;
  }
  const cardinality = cardinalityOf(decl);
  if (cardinality === "tuples") {
    const types = Array.isArray(decl.dataType) ? decl.dataType : [decl.dataType];
    if (!Array.isArray(value)) return "expected an array of tuples ({values: [...]})";
    for (const [i, tuple] of value.entries()) {
      if (!isObject(tuple) || !Array.isArray(tuple.values) || Object.keys(tuple).length !== 1) {
        return `tuple ${i} must be {values: [...]}`;
      }
      if (tuple.values.length !== types.length) {
        return `tuple ${i} has ${tuple.values.length} values; expected ${types.length}`;
      }
      for (const [j, v] of tuple.values.entries()) {
        const reason = checkType(types[j], v);
        if (reason) return `tuple ${i}, value ${j}: ${reason}`;
      }
    }
    return void 0;
  }
  if (Array.isArray(decl.dataType)) return "a dataType array is only valid for tuples keys";
  const type = decl.dataType;
  switch (cardinality) {
    case "single":
      return checkScalar(decl, type, value);
    case "list": {
      if (!Array.isArray(value)) return `expected a list, got ${format(value)}`;
      for (const [i, item] of value.entries()) {
        const reason = checkScalar(decl, type, item);
        if (reason) return `item ${i}: ${reason}`;
      }
      return void 0;
    }
    case "range": {
      if (!isObject(value) || !("min" in value) || !("max" in value) || Object.keys(value).length !== 2) {
        return "a range needs both min and max, and nothing else";
      }
      const reason = checkScalar(decl, type, value.min) ?? checkScalar(decl, type, value.max);
      if (reason) return reason;
      if (compareScalars(value.min, value.max) > 0) return `min ${format(value.min)} is after max ${format(value.max)}`;
      return void 0;
    }
  }
}
function validateState(manifest, values) {
  for (const [name, value] of Object.entries(values)) {
    if (value === void 0) continue;
    const decl = manifest.state?.[name];
    if (!decl) throw unknownStateKey(name);
    const reason = checkStateValue(decl, value);
    if (reason) throw invalidState(name, reason);
  }
}
function sanitizeState(manifest, values) {
  const out = {};
  for (const [name, value] of Object.entries(values ?? {})) {
    const decl = manifest.state?.[name];
    if (decl && behaviorOf(decl).persist && value !== void 0 && checkStateValue(decl, value) === void 0) out[name] = value;
  }
  return out;
}

// src/expand.ts
var PLACEHOLDER = /^([A-Za-z][A-Za-z0-9_]*)(?:\.(min|max))?$/;
function findQuery(manifest, queryId) {
  const query = manifest.queries?.find((q) => q.id === queryId);
  if (!query) throw new DataAppError("UNKNOWN_QUERY", `no named query "${queryId}"`, { queryId });
  return query;
}
function containsRef(node) {
  if (Array.isArray(node)) return node.some(containsRef);
  if (isObject(node)) return "$ref" in node || Object.values(node).some(containsRef);
  return false;
}
function resolveRef(manifest, queryId, section, ref, path) {
  if (Object.keys(ref).length !== 1 || typeof ref.$ref !== "string") {
    throw invalidTemplate(queryId, path, "a $ref object must have exactly one string key, $ref");
  }
  const prefix = `#/${section}/`;
  if (!ref.$ref.startsWith(prefix)) {
    throw invalidTemplate(queryId, path, `$ref in ${section} must point into ${prefix}, got ${ref.$ref}`);
  }
  const name = ref.$ref.slice(prefix.length);
  const fragments = manifest[section];
  const target = fragments?.[name];
  if (!target) throw invalidTemplate(queryId, path, `$ref target ${ref.$ref} does not exist`);
  if (containsRef(target)) throw invalidTemplate(queryId, path, `fragment ${ref.$ref} may not contain $ref`);
  return clone(target);
}
function assertNoRef(dialect, queryId, node, path) {
  if (containsRef(node)) {
    throw invalidTemplate(queryId, path, `$ref is only allowed as an element of ${dialect.refSections.join(" or ")}`);
  }
}
function resolveRefs(manifest, named, dialect) {
  const query = {};
  for (const [key, value] of Object.entries(named.query)) {
    const path = `query.${key}`;
    if (dialect.refSections.includes(key) && Array.isArray(value)) {
      query[key] = value.map(
        (el2, i) => isObject(el2) && "$ref" in el2 ? resolveRef(manifest, named.id, key, el2, `${path}[${i}]`) : (assertNoRef(dialect, named.id, el2, `${path}[${i}]`), clone(el2))
      );
    } else {
      assertNoRef(dialect, named.id, value, path);
      query[key] = clone(value);
    }
  }
  assertNoRef(dialect, named.id, named.options, "options");
  return { query, options: clone(named.options ?? {}) };
}
function parsePlaceholder(queryId, node, path) {
  const raw = node.$state;
  const match = typeof raw === "string" ? PLACEHOLDER.exec(raw) : null;
  if (!match || Object.keys(node).length !== 1) {
    throw invalidTemplate(queryId, path, `malformed placeholder ${JSON.stringify(node)}`);
  }
  return { name: match[1], part: match[2] };
}
function walkRefs(queryId, node, path, visit) {
  if (Array.isArray(node)) {
    node.forEach((x, i) => walkRefs(queryId, x, `${path}[${i}]`, visit));
  } else if (isObject(node)) {
    if ("$state" in node) {
      visit(parsePlaceholder(queryId, node, path).name, path, "state");
      return;
    }
    for (const [key, value] of Object.entries(node)) {
      if (key === "$when") {
        if (typeof value !== "string") throw invalidTemplate(queryId, `${path}.$when`, "$when must name a state key");
        visit(value, `${path}.$when`, "when");
      } else {
        walkRefs(queryId, value, `${path}.${key}`, visit);
      }
    }
  }
}
function orderedRefs(manifest, queryId, resolved) {
  const names = /* @__PURE__ */ new Set();
  const visit = (name, path) => {
    const decl = manifest.state?.[name];
    if (!decl) throw invalidTemplate(queryId, path, `state key ${name} is not declared`);
    if (decl.dataType === "JSON") throw invalidTemplate(queryId, path, `JSON key ${name} cannot be used in a query`);
    names.add(name);
  };
  walkRefs(queryId, resolved.query, "query", visit);
  walkRefs(queryId, resolved.options, "options", visit);
  return [...names];
}
function referencedKeys(manifest, dialect, queryId) {
  return orderedRefs(manifest, queryId, resolveRefs(manifest, findQuery(manifest, queryId), dialect));
}
function resolveState(manifest, store, overrides) {
  const supplied = {};
  for (const [name, value] of Object.entries(store)) {
    if (value !== void 0 && manifest.state?.[name]) supplied[name] = value;
  }
  for (const [name, value] of Object.entries(overrides)) {
    if (value !== void 0) supplied[name] = value;
  }
  validateState(manifest, supplied);
  const effective = /* @__PURE__ */ new Map();
  for (const [name, decl] of Object.entries(manifest.state ?? {})) {
    if (name in supplied) effective.set(name, supplied[name]);
    else if (decl.default !== void 0) effective.set(name, decl.default);
  }
  return effective;
}
var Expander = class {
  constructor(queryId, keys, effective) {
    __publicField(this, "queryId", queryId);
    __publicField(this, "keys", keys);
    __publicField(this, "effective", effective);
    __publicField(this, "omitted", []);
    __publicField(this, "emptyBecause");
  }
  /** Steps 3 and 4 for one element of a dialect element array; undefined when omitted. */
  element(el2, path) {
    if (isObject(el2) && typeof el2.$when === "string") {
      const name = el2.$when;
      const value = this.effective.get(name);
      const isBoolean = this.keys[name]?.dataType === "BOOLEAN";
      if (isBoolean ? value !== true : value === void 0) {
        this.omitted.push({ path, reason: `$when ${name} is ${value === false ? "false" : "not set"}` });
        return void 0;
      }
    }
    let unset;
    walkRefs(this.queryId, el2, path, (name, _p, kind) => {
      if (kind === "state" && unset === void 0 && !this.effective.has(name)) unset = name;
    });
    if (unset !== void 0) {
      this.omitted.push({ path, reason: `${unset} is unset` });
      return void 0;
    }
    return this.substitute(el2, path, path);
  }
  /** Replaces placeholders and strips $-prefixed keys. */
  substitute(node, path, elementPath) {
    if (Array.isArray(node)) return node.map((x, i) => this.substitute(x, `${path}[${i}]`, elementPath));
    if (!isObject(node)) return node;
    if ("$state" in node) return this.placeholder(node, path, elementPath);
    const out = {};
    for (const [key, value] of Object.entries(node)) {
      if (!key.startsWith("$")) out[key] = this.substitute(value, `${path}.${key}`, elementPath);
    }
    return out;
  }
  placeholder(node, path, elementPath) {
    const { name, part } = parsePlaceholder(this.queryId, node, path);
    const decl = this.keys[name];
    const value = this.effective.get(name);
    if (value === void 0) throw invalidTemplate(this.queryId, path, `${name} is unset`);
    const cardinality = cardinalityOf(decl);
    if (cardinality === "range") {
      if (!part) throw invalidTemplate(this.queryId, path, `range key ${name} must be used as ${name}.min or ${name}.max`);
      return clone(value[part]);
    }
    if (part) throw invalidTemplate(this.queryId, path, `.${part} is only valid on range keys; ${name} is ${cardinality}`);
    if ((cardinality === "list" || cardinality === "tuples") && Array.isArray(value) && value.length === 0) {
      this.emptyBecause ?? (this.emptyBecause = { key: name, path: elementPath });
    }
    return clone(value);
  }
};
function explainResolved(manifest, named, store, overrides, dialect) {
  const resolved = resolveRefs(manifest, named, dialect);
  const effective = resolveState(manifest, store, overrides);
  const refs = orderedRefs(manifest, named.id, resolved);
  const expander = new Expander(named.id, manifest.state ?? {}, effective);
  const query = {};
  for (const [key, value] of Object.entries(resolved.query)) {
    const path = `query.${key}`;
    if (dialect.elementArrays.includes(key) && Array.isArray(value)) {
      const kept = [];
      value.forEach((el2, i) => {
        const out = expander.element(el2, `${path}[${i}]`);
        if (out !== void 0) kept.push(out);
      });
      if (kept.length > 0) query[key] = kept;
    } else {
      const out = expander.substitute(value, path, path);
      if (!(Array.isArray(out) && out.length === 0)) query[key] = out;
    }
  }
  const options = {};
  for (const [key, value] of Object.entries(resolved.options)) {
    const path = `options.${key}`;
    if (isObject(value) && "$state" in value) {
      const { name } = parsePlaceholder(named.id, value, path);
      if (!effective.has(name)) {
        expander.omitted.push({ path, reason: `${name} is unset` });
        continue;
      }
    }
    options[key] = expander.substitute(value, path, path);
  }
  const used = refs.filter((n) => effective.has(n));
  const values = Object.fromEntries(used.map((n) => [n, clone(effective.get(n))]));
  const base = { state: { used, unset: refs.filter((n) => !effective.has(n)) }, omitted: expander.omitted, values };
  if (expander.emptyBecause) return { emptyResult: true, emptyBecause: expander.emptyBecause, ...base };
  dialect.checkExpansion?.(named.id, query, (path, reason) => invalidTemplate(named.id, path, reason));
  return { query, options, ...base };
}
function explainDetail(manifest, dialect, queryId, store = {}, overrides = {}) {
  return explainResolved(manifest, findQuery(manifest, queryId), store, overrides, dialect);
}
function explain(manifest, dialect, queryId, store = {}, overrides = {}) {
  const { values: _values2, ...result } = explainDetail(manifest, dialect, queryId, store, overrides);
  return result;
}
function expand(manifest, dialect, queryId, store = {}, overrides = {}) {
  return toExpansion(explainDetail(manifest, dialect, queryId, store, overrides));
}
function toExpansion(result) {
  return result.emptyResult ? { emptyResult: true } : { query: result.query, options: result.options };
}

// src/manifest.ts
var NUMERIC = ["INTEGER", "REAL"];
var DATES = ["DATE", "DATETIME"];
var UNDO_VALUES = ["step", "context", "none"];
var MANIFEST_VERSION = "0.5";
function checkManifestVersion(version, supported = MANIFEST_VERSION) {
  const parsed = typeof version === "string" ? /^(\d+)\.(\d+)$/.exec(version) : null;
  if (!parsed) throw invalid(`manifestVersion must be a "major.minor" string, got ${JSON.stringify(version)}`);
  const [major, minor] = supported.split(".").map(Number);
  const [wantMajor, wantMinor] = [Number(parsed[1]), Number(parsed[2])];
  const gap = wantMajor !== major ? wantMajor - major : major === 0 ? wantMinor - minor : 0;
  if (gap > 0) throw invalid(`manifestVersion ${version} needs a newer data-app library (this one reads ${supported})`);
  if (gap < 0) throw invalid(`manifestVersion ${version} is no longer supported (this library reads ${supported})`);
}
function invalid(reason) {
  return new DataAppError("INVALID_MANIFEST", reason, { reason });
}
function checkManifest(value, dialect, options = {}) {
  if (!isObject(value)) throw invalid("manifest must be a JSON object");
  checkManifestVersion(value.manifestVersion);
  const manifest = value;
  const datasourceIds = new Set((manifest.datasources ?? []).map((d) => d.id));
  const queryIds = /* @__PURE__ */ new Set();
  for (const query of manifest.queries ?? []) {
    if (!isObject(query) || typeof query.id !== "string") throw invalid("every query needs a string id");
    if (queryIds.has(query.id)) throw invalid(`duplicate query id ${query.id}`);
    queryIds.add(query.id);
    if (!datasourceIds.has(query.datasource)) throw invalid(`query ${query.id} uses undeclared datasource ${query.datasource}`);
    if (!isObject(query.query)) throw invalid(`query ${query.id} needs a query object`);
    dialect.checkTemplate?.(query.id, query.query, invalid);
  }
  for (const [name, decl] of Object.entries(manifest.state ?? {})) {
    if (!isObject(decl) || decl.dataType === void 0) throw invalid(`state key ${name} needs a dataType`);
    if (decl.undo !== void 0 && !UNDO_VALUES.includes(decl.undo)) {
      throw invalid(`state key ${name}: undo must be one of ${UNDO_VALUES.join(", ")}`);
    }
    if (decl.dataType === "JSON" && (decl.cardinality ?? "single") !== "single") {
      throw invalid(`state key ${name}: a JSON key holds one JSON value; remove cardinality`);
    }
    const behavior = behaviorOf(decl);
    if (!behavior.persist && behavior.undo === "step") {
      throw invalid(`state key ${name}: persist false needs undo "none" or "context", since undo steps must survive a custom view`);
    }
    checkDomainShape(name, decl);
    if (decl.default !== void 0) {
      const reason = checkStateValue(decl, decl.default);
      if (reason) throw invalid(`state key ${name}: default ${reason}`);
    }
  }
  for (const query of manifest.queries ?? []) {
    try {
      referencedKeys(manifest, dialect, query.id);
    } catch (error) {
      throw asInvalid(error);
    }
  }
  for (const [name, decl] of Object.entries(manifest.state ?? {})) checkFromQuery(manifest, dialect, name, decl);
  const viewIds = /* @__PURE__ */ new Set();
  for (const view of manifest.views ?? []) {
    if (!isObject(view) || typeof view.id !== "string") throw invalid("every view needs a string id");
    if (viewIds.has(view.id)) throw invalid(`duplicate view id ${view.id}`);
    viewIds.add(view.id);
    if (!Array.isArray(view.queries) || view.queries.length === 0) throw invalid(`view ${view.id} needs at least one query`);
    for (const id of [...view.queries, ...view.onDemand ?? []]) {
      if (!queryIds.has(id)) throw invalid(`view ${view.id} lists undeclared query ${id}`);
    }
    const both = (view.onDemand ?? []).find((id) => view.queries.includes(id));
    if (both) throw invalid(`view ${view.id} lists query ${both} in both queries and onDemand`);
    checkEncoding(view.id, view.encoding);
  }
  if (options.debug) checkDeep(manifest, dialect);
  return manifest;
}
var CHANNELS = [
  "x",
  "y",
  "color",
  "size",
  "shape",
  "opacity",
  "text",
  "tooltip",
  "detail",
  "row",
  "column",
  "facet",
  "theta",
  "latitude",
  "longitude",
  "order"
];
function checkEncoding(viewId, encoding) {
  if (encoding === void 0) return;
  if (!isObject(encoding)) throw invalid(`view ${viewId}: encoding must be an object`);
  for (const [channel, spec] of Object.entries(encoding)) {
    if (!CHANNELS.includes(channel)) {
      throw invalid(`view ${viewId}: encoding.${channel} is not a channel (use one of ${CHANNELS.join(", ")})`);
    }
    for (const entry of Array.isArray(spec) ? spec : [spec]) {
      if (!isObject(entry) || typeof entry.field !== "string") throw invalid(`view ${viewId}: encoding.${channel} needs a string field`);
    }
  }
}
function asInvalid(error) {
  return error instanceof DataAppError && error.code === "INVALID_QUERY_TEMPLATE" ? invalid(error.message) : error;
}
function checkDomainShape(name, decl) {
  const domain = decl.domain;
  if (domain === void 0) return;
  const where = `state key ${name}: domain`;
  if (!isObject(domain)) throw invalid(`${where} must be an object`);
  const shapes = [
    domain.members !== void 0,
    domain.min !== void 0 || domain.max !== void 0 || domain.step !== void 0,
    domain.minDate !== void 0 || domain.maxDate !== void 0,
    domain.fromQuery !== void 0
  ].filter(Boolean).length;
  if (shapes !== 1) throw invalid(`${where} needs exactly one of members, min/max/step, minDate/maxDate or fromQuery`);
  if (decl.dataType === "JSON" || Array.isArray(decl.dataType)) throw invalid(`${where} isn't allowed on a JSON or tuples key`);
  const type = decl.dataType;
  if (domain.members !== void 0) {
    if (!Array.isArray(domain.members) || domain.members.length === 0) throw invalid(`${where}.members must be a non-empty list`);
    const scalar = { dataType: type };
    for (const member of domain.members) {
      const reason = checkStateValue(scalar, memberValue(member));
      if (reason) throw invalid(`${where}.members: ${reason}`);
    }
  }
  if (domain.min !== void 0 || domain.max !== void 0 || domain.step !== void 0) {
    if (!NUMERIC.includes(type)) throw invalid(`${where}: min, max and step need an INTEGER or REAL key, not ${type}`);
    for (const bound of ["min", "max", "step"]) {
      const v = domain[bound];
      if (v !== void 0 && (typeof v !== "number" || !Number.isFinite(v))) throw invalid(`${where}.${bound} must be a number`);
    }
    if (domain.step !== void 0 && domain.step <= 0) throw invalid(`${where}.step must be positive`);
    if (domain.min !== void 0 && domain.max !== void 0 && domain.min > domain.max) throw invalid(`${where}.min is above max`);
  }
  if (domain.minDate !== void 0 || domain.maxDate !== void 0) {
    if (!DATES.includes(type)) throw invalid(`${where}: minDate and maxDate need a DATE or DATETIME key, not ${type}`);
    for (const bound of ["minDate", "maxDate"]) {
      const v = domain[bound];
      if (v !== void 0 && (typeof v !== "string" || Number.isNaN(Date.parse(v)))) throw invalid(`${where}.${bound} must be an ISO date`);
    }
    if (domain.minDate !== void 0 && domain.maxDate !== void 0 && compareScalars(domain.minDate, domain.maxDate) > 0) {
      throw invalid(`${where}.minDate is after maxDate`);
    }
  }
}
function checkDeep(manifest, dialect) {
  for (const query of manifest.queries ?? []) {
    try {
      explain(manifest, dialect, query.id);
    } catch (error) {
      if (error instanceof DataAppError) throw invalid(`query ${query.id} doesn't expand at the declared defaults: ${error.message}`);
      throw error;
    }
  }
  if (!dialect.resultColumns) return;
  views: for (const view of manifest.views ?? []) {
    const columns = /* @__PURE__ */ new Set();
    for (const id of [...view.queries, ...view.onDemand ?? []]) {
      const named = manifest.queries?.find((q) => q.id === id);
      const returned = named && dialect.resultColumns(named.query);
      if (!returned) continue views;
      for (const c of returned) columns.add(c);
    }
    for (const [channel, spec] of Object.entries(view.encoding ?? {})) {
      for (const entry of [].concat(spec)) {
        if (!columns.has(entry.field)) {
          throw invalid(`view ${view.id}: encoding.${channel} uses ${entry.field}, which none of its queries return (they return ${[...columns].join(", ")})`);
        }
      }
    }
  }
}
function checkFromQuery(manifest, dialect, name, decl) {
  const source = decl.domain?.fromQuery;
  if (source === void 0) return;
  const where = `state key ${name}: domain.fromQuery`;
  if (!isObject(source) || typeof source.query !== "string" || typeof source.field !== "string") {
    throw invalid(`${where} needs a string query and field`);
  }
  if (source.alias !== void 0 && typeof source.alias !== "string") throw invalid(`${where}.alias must be a string`);
  const named = manifest.queries?.find((q) => q.id === source.query);
  if (!named) throw invalid(`${where} names undeclared query ${source.query}`);
  if (decl.dataType === "JSON" || Array.isArray(decl.dataType) || !["single", "list"].includes(cardinalityOf(decl))) {
    throw invalid(`${where} needs a single or list key with one scalar dataType`);
  }
  if (referencedKeys(manifest, dialect, source.query).includes(name)) {
    throw invalid(`${where}: query ${source.query} reads ${name} itself, so its choices would change with every choice`);
  }
  const columns = dialect.resultColumns?.(named.query);
  for (const column of [source.field, source.alias]) {
    if (columns && column !== void 0 && !columns.includes(column)) {
      throw invalid(`${where}: query ${source.query} returns no column ${column} (it returns ${columns.join(", ")})`);
    }
  }
}
async function loadManifest(path, options) {
  const doFetch = options.fetch ?? globalThis.fetch;
  const base = options.baseUrl ?? globalThis.document?.baseURI ?? globalThis.location?.href;
  const file = path ?? "app-manifest.json";
  const url = base ? new URL(file, base).href : file;
  let body;
  try {
    const response = await doFetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    body = await response.json();
  } catch (error) {
    throw new DataAppError("MANIFEST_LOAD_FAILED", `could not load ${url}: ${error.message}`, {
      reason: error.message
    });
  }
  return checkManifest(body, options.dialect, { debug: options.debug });
}
function resolveText(manifest, text, locale) {
  if (text === void 0 || typeof text === "string") return text;
  const entry = manifest.resources?.[text.resourceId];
  if (!entry) return void 0;
  return (locale && entry[locale]) ?? (manifest.defaultLocale ? entry[manifest.defaultLocale] : void 0);
}

// src/timeline.ts
var DEFAULTS = { changes: 50, entries: 500, loadEntries: 2e3 };
var _recent, _byRevision, _limits, _loadOpen, _latest, _calls, _Timeline_instances, ready_fn, run_fn, open_fn, append_fn, push_fn;
var Timeline = class {
  constructor(initialRevision, history = {}) {
    __privateAdd(this, _Timeline_instances);
    __publicField(this, "load");
    __privateAdd(this, _recent, []);
    __privateAdd(this, _byRevision, /* @__PURE__ */ new Map());
    __privateAdd(this, _limits);
    __privateAdd(this, _loadOpen, true);
    __privateAdd(this, _latest);
    __privateAdd(this, _calls);
    __privateSet(this, _limits, { ...DEFAULTS, ...history });
    this.load = interaction("load", initialRevision);
    __privateGet(this, _byRevision).set(initialRevision, this.load);
    __privateSet(this, _latest, initialRevision);
  }
  /** Interactions after the load, newest first. */
  get recent() {
    return [...__privateGet(this, _recent)].reverse();
  }
  commit(revision, source) {
    __privateSet(this, _latest, Math.max(__privateGet(this, _latest), revision));
    if (__privateGet(this, _loadOpen)) {
      this.load.revisions.push(revision);
      __privateGet(this, _byRevision).set(revision, this.load);
      return;
    }
    __privateMethod(this, _Timeline_instances, open_fn).call(this, "change", revision).source = source;
  }
  add(event) {
    if (event.type === "span") __privateMethod(this, _Timeline_instances, push_fn).call(this, this.load, this.load.spans, event);
    else if (event.type === "ready") __privateMethod(this, _Timeline_instances, ready_fn).call(this, event);
    else __privateMethod(this, _Timeline_instances, run_fn).call(this, event);
  }
};
_recent = new WeakMap();
_byRevision = new WeakMap();
_limits = new WeakMap();
_loadOpen = new WeakMap();
_latest = new WeakMap();
_calls = new WeakMap();
_Timeline_instances = new WeakSet();
ready_fn = function(ready) {
  if (__privateGet(this, _loadOpen)) {
    __privateSet(this, _loadOpen, false);
    this.load.ready = ready;
    return;
  }
  const target = __privateGet(this, _byRevision).get(ready.revision) ?? __privateMethod(this, _Timeline_instances, open_fn).call(this, "change", ready.revision);
  target.ready = ready;
  target.source ?? (target.source = ready.source);
  for (const revision of ready.superseded) {
    const other = __privateGet(this, _byRevision).get(revision);
    if (!other || other === target || other === this.load) continue;
    for (const r of other.revisions) __privateGet(this, _byRevision).set(r, target);
    target.revisions.push(...other.revisions);
    for (const run of other.runs) __privateMethod(this, _Timeline_instances, push_fn).call(this, target, target.runs, run);
    target.truncated || (target.truncated = other.truncated);
    __privateGet(this, _recent).splice(__privateGet(this, _recent).indexOf(other), 1);
  }
  target.revisions.sort((a, b) => a - b);
};
run_fn = function(run) {
  let target = __privateGet(this, _byRevision).get(run.revision);
  const settled = target?.ready && run.startedAt >= target.ready.at;
  if (run.trigger === "query" && (settled || !target)) {
    const calls = __privateGet(this, _calls);
    target = calls && __privateGet(this, _recent).at(-1) === calls && calls.revisions[0] === run.revision ? calls : __privateSet(this, _calls, __privateMethod(this, _Timeline_instances, append_fn).call(this, "query", run.revision));
  } else if (!target) {
    if (run.revision <= __privateGet(this, _latest) && !__privateGet(this, _loadOpen)) return;
    target = __privateMethod(this, _Timeline_instances, open_fn).call(this, "change", run.revision);
  }
  __privateMethod(this, _Timeline_instances, push_fn).call(this, target, target.runs, run);
};
open_fn = function(kind, revision) {
  __privateSet(this, _latest, Math.max(__privateGet(this, _latest), revision));
  const created = __privateMethod(this, _Timeline_instances, append_fn).call(this, kind, revision);
  __privateGet(this, _byRevision).set(revision, created);
  return created;
};
append_fn = function(kind, revision) {
  const created = interaction(kind, revision);
  __privateGet(this, _recent).push(created);
  while (__privateGet(this, _recent).length > __privateGet(this, _limits).changes) {
    const dropped = __privateGet(this, _recent).shift();
    for (const r of dropped.revisions) if (__privateGet(this, _byRevision).get(r) === dropped) __privateGet(this, _byRevision).delete(r);
    if (__privateGet(this, _calls) === dropped) __privateSet(this, _calls, void 0);
  }
  return created;
};
push_fn = function(target, list, entry) {
  const cap = target === this.load ? __privateGet(this, _limits).loadEntries : __privateGet(this, _limits).entries;
  if (target.spans.length + target.runs.length >= cap) target.truncated = true;
  else list.push(entry);
};
function boundsOf(target) {
  const entries = [...target.spans, ...target.runs];
  const starts = entries.map((e) => e.startedAt);
  const ends = entries.map((e) => e.at);
  const ready = target.ready;
  if (ready) {
    starts.push(ready.at - (ready.elapsedSinceFirstMs ?? ready.elapsedMs));
    ends.push(ready.at);
  }
  if (starts.length === 0) return { start: 0, end: 0 };
  return { start: Math.min(...starts), end: Math.max(...ends) };
}
function interaction(kind, revision) {
  return { kind, revisions: [revision], spans: [], runs: [], truncated: false };
}

// src/default-inspector.ts
var STYLE = `
:host { all: initial; }
.layer { position: fixed; inset: 0; pointer-events: none; font: 14px/1.5 system-ui, sans-serif; color: #1f1f1f; }
.box { position: fixed; box-sizing: border-box; border: 2px dashed #1f6fd1; border-radius: 4px; background: rgba(31, 111, 209, 0.06); }
.box.selected { border-style: solid; background: rgba(31, 111, 209, 0.12); }
.chip { position: absolute; top: 2px; left: 2px; max-width: calc(100% - 4px); pointer-events: auto; cursor: pointer; border: 0;
  border-radius: 3px; padding: 2px 8px; background: #1f6fd1; color: #fff; font: 13px/1.4 system-ui, sans-serif; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.chip.warn { background: #b3591c; }
.panel { position: fixed; top: 0; right: 0; bottom: 0; width: min(620px, 94vw); box-sizing: border-box; display: flex; flex-direction: column;
  pointer-events: auto; background: #fff; border-left: 1px solid #c9c9c9; box-shadow: -4px 0 16px rgba(0, 0, 0, 0.15); }
.header { display: flex; align-items: center; gap: 4px; padding: 8px 12px; border-bottom: 1px solid #e3e3e3; background: #fafafa; flex: none; }
.header .spacer { flex: 1; }
.tab, .back, .close { border: 0; border-radius: 4px; background: none; padding: 4px 10px; cursor: pointer; font: inherit; color: #1f1f1f; }
.tab:hover, .back:hover, .close:hover { background: #ececec; }
.tab.active { background: #1f6fd1; color: #fff; }
.back:disabled { opacity: 0.35; cursor: default; background: none; }
.close { font-size: 18px; line-height: 1; }
.body { flex: 1; overflow: auto; padding: 14px 18px 24px; }
h2 { font-size: 18px; margin: 0 0 6px; }
h3 { font-size: 14px; margin: 20px 0 6px; }
p { margin: 4px 0; }
.muted { color: #6b6b6b; }
.warn-text { color: #b3591c; }
.mono { font-family: ui-monospace, monospace; font-size: 13px; }
h2.mono { font-size: 17px; }
.link { border: 0; background: none; padding: 0; color: #1f6fd1; cursor: pointer; font: inherit; text-decoration: underline; text-align: left; }
.item { border: 1px solid #e3e3e3; border-radius: 6px; padding: 8px 10px; margin: 8px 0; }
.item .title { display: flex; justify-content: space-between; gap: 8px; }
.tag { font-size: 12px; color: #6b6b6b; border: 1px solid #d6d6d6; border-radius: 3px; padding: 0 4px; }
.kv { display: grid; grid-template-columns: max-content 1fr; gap: 4px 12px; margin: 6px 0; }
.kv .key { color: #6b6b6b; }
.interactions { display: flex; flex-direction: column; max-height: 190px; overflow: auto; border: 1px solid #e3e3e3; border-radius: 6px; margin: 8px 0 14px; }
.pick { display: flex; justify-content: space-between; gap: 8px; border: 0; border-bottom: 1px solid #efefef; background: #fff; padding: 6px 10px;
  cursor: pointer; font: inherit; text-align: left; }
.pick:last-child { border-bottom: 0; }
.pick:hover { background: #f4f7fc; }
.pick.chosen { background: rgba(31, 111, 209, 0.12); }
.legend { display: flex; flex-wrap: wrap; gap: 4px 12px; margin: 8px 0; font-size: 12px; color: #6b6b6b; }
.legend span { display: inline-flex; align-items: center; gap: 4px; }
.legend i { display: inline-block; width: 14px; height: 10px; border-radius: 2px; }
.axis { display: grid; grid-template-columns: 190px 1fr 72px; gap: 8px; font-size: 12px; color: #6b6b6b; margin-top: 10px; }
.axis .ends { display: flex; justify-content: space-between; }
.row { display: grid; grid-template-columns: 190px 1fr 72px; gap: 8px; align-items: center; padding: 3px 0; border-radius: 3px; cursor: pointer; }
.row:hover, .row.open { background: #f4f7fc; }
.row.dim { opacity: 0.55; }
.name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 13px ui-monospace, monospace; padding-left: 4px; }
.ms { text-align: right; font: 13px ui-monospace, monospace; padding-right: 4px; }
.track { position: relative; height: 14px; background: #f1f1f1; border-radius: 2px; }
.bar { position: absolute; top: 1px; bottom: 1px; min-width: 2px; border-radius: 2px; }
.bar, .legend i { background: #1f6fd1; }
.bar.span, .legend i.span { background: #7a4fc9; }
.bar.render, .legend i.render { background: #2e8540; }
.bar.cache, .bar.none, .legend i.cache { background: #9a9a9a; }
.bar.shared, .legend i.shared { background: none; border: 1px solid #1f6fd1; box-sizing: border-box; }
.bar.ready, .legend i.ready { background: #b3591c; width: 2px; }
.detail { margin: 2px 0 8px; padding: 8px 10px; background: #f7f7f7; border-radius: 4px; }
.detail .links { display: flex; flex-wrap: wrap; gap: 4px 12px; margin-top: 4px; }
pre { margin: 6px 0; padding: 8px; background: #f4f4f4; border-radius: 4px; overflow: auto; max-height: 320px; font: 13px/1.45 ui-monospace, monospace; }
`;
var TABS = [
  { label: "Views", kind: "views" },
  { label: "State", kind: "state" },
  { label: "Timeline", kind: "timeline" }
];
var defaultInspector = (context) => {
  const { app, document: doc, timeline } = context;
  const host = doc.createElement("div");
  host.setAttribute("data-app-inspector", "");
  host.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:2147483647;display:none";
  const root = host.attachShadow({ mode: "open" });
  const style = doc.createElement("style");
  style.textContent = STYLE;
  const layer = el(doc, "div", "layer");
  root.append(style, layer);
  const boxes = /* @__PURE__ */ new Map();
  let page;
  const history = [];
  let chosen;
  let openRow;
  let frame;
  let mounted = false;
  const views = new Map((app.manifest.views ?? []).map((v) => [v.id, v]));
  const queriesOf = (view) => [...view.queries, ...view.onDemand ?? []];
  const text = (value) => resolveText(app.manifest, value);
  const viewTitle = (id) => {
    const view = views.get(id);
    return view ? text(view.title) ?? id : id;
  };
  function go(next) {
    if (next && page && keyOf(next) === keyOf(page)) return;
    if (next && page) history.push(page);
    if (!next) history.length = 0;
    if (history.length > 50) history.shift();
    page = next;
    renderPanel();
  }
  function goBack() {
    page = history.pop() ?? page;
    renderPanel();
  }
  function drawBoxes() {
    const found = context.viewElements();
    const live = new Set(found.map((t) => t.element));
    for (const [element, entry] of boxes) {
      if (!live.has(element)) {
        entry.box.remove();
        boxes.delete(element);
      }
    }
    const selectedView = page?.kind === "view" ? page.id : void 0;
    for (const { viewId, element } of found) {
      let entry = boxes.get(element);
      if (!entry || entry.viewId !== viewId) {
        entry?.box.remove();
        entry = { viewId, box: makeBox(viewId) };
        boxes.set(element, entry);
        layer.prepend(entry.box);
      }
      const rect = element.getBoundingClientRect();
      const box = entry.box.style;
      box.display = rect.width === 0 && rect.height === 0 ? "none" : "block";
      box.left = `${rect.left}px`;
      box.top = `${rect.top}px`;
      box.width = `${rect.width}px`;
      box.height = `${rect.height}px`;
      entry.box.classList.toggle("selected", viewId === selectedView);
    }
  }
  function makeBox(viewId) {
    const box = el(doc, "div", "box");
    const view = views.get(viewId);
    const label = view ? `${text(view.title) ?? viewId} - ${queriesOf(view).length} queries` : `${viewId} (not in manifest)`;
    const chip = button(doc, view ? "chip" : "chip warn", label);
    chip.addEventListener("click", () => go({ kind: "view", id: viewId }));
    box.append(chip);
    return box;
  }
  function link(label, target, className = "link") {
    const node = button(doc, className, label);
    node.addEventListener("click", (event) => {
      event.stopPropagation();
      go(target);
    });
    return node;
  }
  function renderPanel() {
    const previous = layer.querySelector(".panel");
    const scrollTop = previous && page && previous.dataset.page === keyOf(page) ? previous.querySelector(".body")?.scrollTop ?? 0 : 0;
    previous?.remove();
    if (!page) return;
    const panel = el(doc, "div", "panel");
    panel.dataset.page = keyOf(page);
    const header = el(doc, "div", "header");
    const back = button(doc, "back", "<");
    back.setAttribute("aria-label", "Back");
    back.disabled = history.length === 0;
    back.addEventListener("click", goBack);
    header.append(back);
    const section = page.kind === "view" ? "views" : page.kind === "query" ? history.at(-1)?.kind === "timeline" ? "timeline" : "views" : page.kind;
    for (const tab of TABS) header.append(link(tab.label, { kind: tab.kind }, tab.kind === section ? "tab active" : "tab"));
    header.append(el(doc, "div", "spacer"));
    const close = button(doc, "close", "x");
    close.setAttribute("aria-label", "Close");
    close.addEventListener("click", () => context.exit());
    header.append(close);
    const body = el(doc, "div", "body");
    if (page.kind === "views") renderViews(body);
    else if (page.kind === "state") renderState(body);
    else if (page.kind === "timeline") renderTimeline(body);
    else if (page.kind === "view") renderView(body, page.id);
    else renderQuery(body, page.id);
    panel.append(header, body);
    layer.append(panel);
    body.scrollTop = scrollTop;
  }
  function renderViews(body) {
    body.append(el(doc, "h2", "", "Views"));
    const onPage = new Set(context.viewElements().map((t) => t.viewId));
    for (const view of views.values()) {
      const item = el(doc, "div", "item");
      const title = el(doc, "div", "title");
      title.append(link(text(view.title) ?? view.id, { kind: "view", id: view.id }), el(doc, "span", "muted", `${queriesOf(view).length} queries`));
      item.append(title);
      if (!onPage.has(view.id)) item.append(el(doc, "p", "warn-text", `Not on the page: no element has data-app-view="${view.id}".`));
      body.append(item);
    }
    const declared = new Set([...views.values()].flatMap(queriesOf));
    const loose = (app.manifest.queries ?? []).filter((q) => !declared.has(q.id));
    if (loose.length > 0) {
      body.append(el(doc, "h3", "", "Queries not in any view"));
      for (const query of loose) {
        const p = el(doc, "p");
        p.append(link(query.id, { kind: "query", id: query.id }));
        body.append(p);
      }
    }
  }
  function renderView(body, viewId) {
    const view = views.get(viewId);
    body.append(el(doc, "h2", "", viewTitle(viewId)));
    if (!view) {
      body.append(el(doc, "p", "muted", `No view "${viewId}" is declared in app-manifest.json, so its queries are unknown.`));
      return;
    }
    const description = text(view.description);
    if (description) body.append(el(doc, "p", "muted", description));
    const channels = Object.entries(view.encoding ?? {});
    if (channels.length > 0) {
      body.append(el(doc, "h3", "", "Shows"));
      const facets = channels.filter(([channel]) => FACET_CHANNELS.includes(channel));
      for (const [channel, spec] of facets) {
        body.append(el(doc, "p", "", `One panel per ${fieldsOf(spec)}${channel === "facet" ? "" : `, laid out in ${channel}s`}.`));
      }
      const facts = el(doc, "div", "kv");
      for (const [channel, spec] of channels) {
        if (!FACET_CHANNELS.includes(channel)) facts.append(el(doc, "div", "key", channel), el(doc, "div", "", describeChannel(spec)));
      }
      body.append(facts);
    }
    body.append(el(doc, "h3", "", "Queries"));
    for (const queryId of queriesOf(view)) {
      const item = el(doc, "div", "item");
      const title = el(doc, "h3", "title");
      title.style.margin = "0";
      title.append(link(queryId, { kind: "query", id: queryId }));
      if (view.onDemand?.includes(queryId)) title.append(el(doc, "span", "tag", "on demand"));
      item.append(title);
      const run = context.lastRun(queryId);
      item.append(run ? el(doc, "p", "", `Last run: ${runSummary(run)}`) : el(doc, "p", "muted", "Not run by a subscription yet."));
      body.append(item);
    }
  }
  function renderQuery(body, queryId) {
    body.append(el(doc, "h2", "mono", queryId));
    const named = app.manifest.queries?.find((q) => q.id === queryId);
    if (named?.description) body.append(el(doc, "p", "muted", named.description));
    const facts = el(doc, "div", "kv");
    const fact = (key, value) => {
      const cell = el(doc, "div");
      cell.append(value);
      facts.append(el(doc, "div", "key", key), cell);
    };
    if (named) fact("Datasource", named.datasource);
    const users = [...views.values()].filter((v) => queriesOf(v).includes(queryId));
    if (users.length > 0) {
      const cell = el(doc, "div", "links");
      users.forEach((v, i) => {
        if (i > 0) cell.append(", ");
        cell.append(link(text(v.title) ?? v.id, { kind: "view", id: v.id }));
      });
      fact("Used by", cell);
    }
    const run = context.lastRun(queryId);
    fact("Last run", run ? runSummary(run) : "not run by a subscription yet");
    try {
      const result = app.query(queryId).explain();
      if (result.state.used.length > 0) fact("State read", result.state.used.join(", "));
      if (result.state.unset.length > 0) fact("Unset", result.state.unset.join(", "));
      if (result.emptyBecause) fact("Empty because", `${result.emptyBecause.key} is empty (${result.emptyBecause.path})`);
      body.append(facts);
      for (const omission of result.omitted) body.append(el(doc, "p", "muted", `Omitted ${omission.path}: ${omission.reason}`));
      if (result.query) {
        body.append(el(doc, "h3", "", "Query sent"));
        body.append(el(doc, "pre", "", JSON.stringify(result.options ? { query: result.query, options: result.options } : result.query, null, 2)));
      }
    } catch (error) {
      body.append(facts);
      body.append(el(doc, "p", "warn-text", `Cannot expand: ${error instanceof Error ? error.message : String(error)}`));
    }
    const runs = [timeline.load, ...timeline.recent].flatMap((i) => i.runs.filter((r) => r.queryId === queryId).map((r) => ({ r, i })));
    if (runs.length > 0) {
      body.append(el(doc, "h3", "", "Recent runs"));
      for (const { r, i } of runs.sort((a, b) => b.r.startedAt - a.r.startedAt).slice(0, 10)) {
        const p = el(doc, "p");
        const open = button(doc, "link", interactionLabel(i));
        open.addEventListener("click", () => {
          chosen = i;
          go({ kind: "timeline" });
        });
        p.append(`${runSummary(r)} for ${callerOf(r)} - `, open);
        body.append(p);
      }
    }
  }
  function renderState(body) {
    body.append(el(doc, "h2", "", "State"));
    body.append(el(doc, "p", "muted", `Revision ${app.state.revision}`));
    for (const [name, decl] of Object.entries(app.manifest.state ?? {})) {
      const { undo, persist, agents } = behaviorOf(decl);
      const item = el(doc, "div", "item");
      item.append(el(doc, "div", "mono", `${name} = ${JSON.stringify(app.state.key(name).value) ?? "unset"}`));
      const flags = [decl.dataType === "JSON" ? "JSON" : String(decl.dataType), `undo ${undo}`, persist ? "saved" : "not saved", agents ? "agents" : "hidden from agents"];
      item.append(el(doc, "p", "muted", flags.join(" - ")));
      const source = decl.domain?.fromQuery;
      if (source) item.append(el(doc, "p", "muted", `choices: ${source.field} from query ${source.query}`));
      body.append(item);
    }
  }
  function renderTimeline(body) {
    body.append(el(doc, "h2", "", "Timeline"));
    body.append(el(doc, "p", "muted", "The load, then each state change, newest first. Click a row for details. Alt+Shift+I toggles inspect mode."));
    const cache = context.cache();
    body.append(
      el(doc, "p", "", `Cache: ${count(cache.entries, "result")} (${cache.held} on screen), ${count(cache.rows, "row")}; ${cache.limit === 0 ? "past results aren't kept" : `up to ${count(cache.limit, "past result")} kept`}.`)
    );
    const all = [...timeline.recent, timeline.load];
    if (!chosen || !all.includes(chosen)) chosen = timeline.recent[0] ?? timeline.load;
    const list = el(doc, "div", "interactions");
    for (const item of all) {
      const pick = button(doc, item === chosen ? "pick chosen" : "pick", "");
      const [label, total] = interactionParts(item);
      pick.append(el(doc, "span", "", label), el(doc, "span", "muted", total));
      pick.addEventListener("click", () => {
        chosen = item;
        openRow = void 0;
        renderPanel();
      });
      list.append(pick);
    }
    body.append(list);
    renderInteraction(body, chosen);
  }
  function renderInteraction(body, item) {
    const { start, end } = boundsOf(item);
    const ready = item.ready;
    const rows = rowsOf(item);
    const requests = rows.filter((r) => r.kind === "request");
    const facts = el(doc, "div", "kv");
    const fact = (key, value) => facts.append(el(doc, "div", "key", key), el(doc, "div", "", value));
    fact("ready()", ready ? `after ${ms(ready.at - start)}` : "not reported yet");
    if (requests.length > 0) fact("Requests", `${requests.length} sent, at most ${maxOverlap(requests)} at once`);
    if (ready && ready.superseded.length > 0) fact("Superseded", `revisions ${ready.superseded.join(", ")}`);
    if (ready && ready.pendingRuns.length > 0) fact("Still running at ready()", String(ready.pendingRuns.length));
    if (item.truncated) fact("Truncated", "later entries were dropped");
    body.append(facts);
    if (rows.length === 0) {
      body.append(el(doc, "p", "muted", "Nothing ran."));
      return;
    }
    const legend = el(doc, "div", "legend");
    for (const [kind, label] of [["request", "request"], ["shared", "shared"], ["cache", "cache or empty"], ["render", "render"], ["span", "startup"], ["ready", "ready()"]]) {
      const entry = el(doc, "span");
      entry.append(el(doc, "i", kind), label);
      legend.append(entry);
    }
    body.append(legend);
    const axis = el(doc, "div", "axis");
    const ends = el(doc, "div", "ends");
    ends.append(el(doc, "span", "", "0 ms"), el(doc, "span", "", ms(end - start)));
    axis.append(el(doc, "div"), ends, el(doc, "div"));
    body.append(axis);
    const span = Math.max(end - start, 1);
    for (const row of rows) {
      const key = `${row.kind}|${row.name}|${row.start}`;
      const line = el(doc, "div", ["row", row.dim && "dim", key === openRow && "open"].filter(Boolean).join(" "));
      line.title = row.detail;
      line.addEventListener("click", () => {
        openRow = openRow === key ? void 0 : key;
        renderPanel();
      });
      const track = el(doc, "div", "track");
      const bar = el(doc, "div", `bar ${row.kind}`);
      bar.style.left = `${(row.start - start) / span * 100}%`;
      if (row.kind !== "ready") bar.style.width = `${(row.end - row.start) / span * 100}%`;
      track.append(bar);
      line.append(el(doc, "div", "name", row.name), track, el(doc, "div", "ms", row.kind === "ready" ? "" : ms(row.end - row.start)));
      body.append(line);
      if (key !== openRow) continue;
      const detail = el(doc, "div", "detail");
      detail.append(el(doc, "div", "", row.detail), el(doc, "div", "muted", `starts at ${ms(row.start - start)}`));
      const links = el(doc, "div", "links");
      for (const queryId of row.queries) links.append(link(`Query ${queryId}`, { kind: "query", id: queryId }));
      for (const viewId of row.views) links.append(link(`View ${viewTitle(viewId)}`, { kind: "view", id: viewId }));
      if (links.childElementCount > 0) detail.append(links);
      body.append(detail);
    }
  }
  function tick() {
    drawBoxes();
    frame = requestAnimationFrame(tick);
  }
  function setVisible(visible) {
    if (visible) {
      if (!mounted) {
        doc.documentElement.append(host);
        mounted = true;
      }
      host.style.display = "block";
      if (frame === void 0) tick();
      if (!page) go({ kind: "views" });
    } else {
      host.style.display = "none";
      if (frame !== void 0) cancelAnimationFrame(frame);
      frame = void 0;
      go(void 0);
    }
  }
  const offUpdate = context.onUpdate(() => {
    if (mounted && host.style.display !== "none") renderPanel();
  });
  return {
    open: () => setVisible(true),
    close: () => setVisible(false),
    dispose() {
      offUpdate();
      setVisible(false);
      host.remove();
    }
  };
};
function keyOf(page) {
  return "id" in page ? `${page.kind}:${page.id}` : page.kind;
}
function count(n, noun) {
  return `${n.toLocaleString("en-US")} ${noun}${n === 1 ? "" : "s"}`;
}
function runSummary(run) {
  const parts = [`revision ${run.revision}`, run.outcome, `query ${ms(run.queryMs)}`];
  if (run.renderMs !== void 0) parts.push(`render ${ms(run.renderMs)}`);
  if (run.rows !== void 0) parts.push(`${run.rows} rows`);
  if (run.served !== "request") parts.push(run.served === "none" ? "not sent" : run.served);
  return parts.join(", ");
}
function interactionParts(item) {
  const { start, end } = boundsOf(item);
  const total = item.ready ? ms(item.ready.at - start) : `${ms(end - start)}, no ready()`;
  if (item.kind === "load") return ["Load", total];
  const revision = item.revisions[item.revisions.length - 1];
  if (item.kind === "query") return [`query run at revision ${revision}`, `${item.runs.length} runs`];
  return [`Revision ${revision}${item.source ? ` (${item.source})` : ""}`, total];
}
function interactionLabel(item) {
  return interactionParts(item).join(" - ");
}
var FACET_CHANNELS = ["facet", "row", "column"];
function fieldsOf(spec) {
  return [].concat(spec).map((c) => c.field).join(", ");
}
function describeChannel(spec) {
  return [].concat(spec).map((c) => {
    const notes = [c.type, c.sort && describeSort(c.sort)].filter(Boolean);
    return notes.length > 0 ? `${c.field} (${notes.join(", ")})` : c.field;
  }).join("; ");
}
function describeSort(sort) {
  if (sort === "ascending" || sort === "descending") return `sorted ${sort}`;
  return `sorted by ${sort.replace("-", "")}, ${sort.startsWith("-") ? "descending" : "ascending"}`;
}
function callerOf(run) {
  if (run.caller === "render") return `view ${run.view}`;
  if (run.caller === "query") return `query run${run.view !== void 0 ? ` for ${run.view}` : ""}`;
  if (run.caller === "domain") return `choices for ${run.key}`;
  return `subscribe${run.view !== void 0 ? ` for ${run.view}` : ""}`;
}
function rowsOf(item) {
  const rows = item.spans.map((span) => ({
    name: span.name,
    detail: `startup step, ${ms(span.durationMs)}`,
    kind: "span",
    start: span.startedAt,
    end: span.at,
    dim: false,
    queries: [],
    views: []
  }));
  const sent = /* @__PURE__ */ new Map();
  for (const run of item.runs) {
    if (run.requestId === void 0) continue;
    const users = sent.get(run.requestId) ?? [];
    users.push(run);
    sent.set(run.requestId, users);
  }
  const viewsOf = (runs) => [...new Set(runs.flatMap((r) => r.view !== void 0 ? [r.view] : []))];
  const renders = /* @__PURE__ */ new Map();
  for (const run of item.runs) {
    const users = run.requestId !== void 0 ? sent.get(run.requestId) : [run];
    const joined = run.served === "shared" && users.some((u) => u.served === "request");
    if (!joined) {
      const label = run.served === "none" ? `${run.queryId} (empty)` : run.served === "request" ? run.queryId : `${run.queryId} (${run.served})`;
      const sharers = run.served === "request" ? users.filter((u) => u === run || u.served === "shared") : [run];
      const callers = [...new Set(sharers.map(callerOf))].join(", ");
      const rowCount = run.rows !== void 0 ? `, ${run.rows} rows` : "";
      const how = { request: "sent", shared: "joined a request in flight", cache: "from cache", none: "proved empty, not sent" }[run.served];
      rows.push({
        name: label,
        detail: `${how}, ${run.outcome}${rowCount}, for ${callers}, revision ${run.revision}${run.afterReady ? ", finished after ready()" : ""}`,
        kind: run.served,
        start: run.startedAt,
        end: run.startedAt + run.queryMs,
        dim: run.outcome === "stale" || run.outcome === "cancelled",
        queries: [run.queryId],
        views: viewsOf(sharers)
      });
    }
    if (run.renderMs !== void 0) {
      const key = `${run.caller}|${run.view ?? run.queryId}|${run.at}`;
      renders.set(key, [...renders.get(key) ?? [], run]);
    }
  }
  for (const runs of renders.values()) {
    const run = runs[0];
    const what = run.caller === "render" ? `render ${run.view}` : run.caller === "domain" ? `choices for ${run.key}` : `callback ${run.queryId}`;
    rows.push({
      name: what,
      detail: `${run.outcome === "error" ? "failed" : "drew"} ${runs.map((r) => r.queryId).join(", ")}`,
      kind: "render",
      start: run.at - run.renderMs,
      end: run.at,
      dim: false,
      queries: [...new Set(runs.map((r) => r.queryId))],
      views: viewsOf(runs)
    });
  }
  if (item.ready) {
    rows.push({ name: "ready()", detail: `revision ${item.ready.revision}`, kind: "ready", start: item.ready.at, end: item.ready.at, dim: false, queries: [], views: [] });
  }
  return rows.sort((a, b) => a.start - b.start || (a.kind === "ready" ? 1 : 0) - (b.kind === "ready" ? 1 : 0));
}
function maxOverlap(rows) {
  let most = 0;
  for (const row of rows) {
    const running = rows.filter((other) => other === row || other.start <= row.start && other.end > row.start).length;
    most = Math.max(most, running);
  }
  return most;
}
function ms(value) {
  return `${Math.round(value)} ms`;
}
function el(doc, tag, className = "", content) {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (content !== void 0) node.textContent = content;
  return node;
}
function button(doc, className, label) {
  const node = doc.createElement("button");
  node.type = "button";
  node.className = className;
  node.textContent = label;
  return node;
}

// src/domains.ts
var _manifest, _engine, _state, _stops, _Domains_instances, currentKey_fn;
var Domains = class {
  constructor(manifest, engine, state) {
    __privateAdd(this, _Domains_instances);
    __privateAdd(this, _manifest);
    __privateAdd(this, _engine);
    __privateAdd(this, _state);
    __privateAdd(this, _stops, /* @__PURE__ */ new Set());
    __privateSet(this, _manifest, manifest);
    __privateSet(this, _engine, engine);
    __privateSet(this, _state, state);
  }
  /** Calls back with the key's choices, value and missing values now and whenever one of them changes. */
  subscribe(name, decl, callback, options) {
    __privateGet(this, _engine).assertLive();
    const domain = decl.domain;
    if (!domain?.members && !domain?.fromQuery || !["single", "list"].includes(cardinalityOf(decl))) {
      throw new DataAppError("UNSUPPORTED", `state key ${name} needs a members or fromQuery domain and a single or list cardinality`);
    }
    const source = domain.fromQuery;
    let members = domain.members?.map(choiceOf);
    let expansion;
    let active = true;
    let queued = false;
    let status;
    const report = (error) => {
      if (options.onError) options.onError(error);
      else console.error(`[data-app] domain of ${name} failed`, error);
    };
    const setStatus2 = (next) => {
      if (source || status === next) return;
      status = next;
      options.onStatus?.(next);
    };
    const emit = () => {
      const value = __privateGet(this, _state).key(name).value;
      return callback({ members: members.map((m) => ({ ...m })), value, missing: missingFrom(members, value) });
    };
    const redraw = () => {
      if (queued || !active) return;
      queued = true;
      __privateGet(this, _engine).track(
        (async () => {
          await Promise.resolve();
          queued = false;
          if (!active || !members) return;
          if (source && expansion !== __privateMethod(this, _Domains_instances, currentKey_fn).call(this, source.query)) return;
          try {
            await emit();
            setStatus2("ready");
          } catch (error) {
            setStatus2("error");
            report(error);
          }
        })()
      );
    };
    const stopEngine = source ? __privateGet(this, _engine).subscribe({
      label: `domain of ${name}`,
      queryIds: [source.query],
      caller: "domain",
      stateKey: name,
      deliver: ([result], [key]) => {
        members = choicesFrom(result, source.field, source.alias);
        expansion = key;
        return emit();
      },
      onError: options.onError,
      onStatus: options.onStatus
    }) : void 0;
    const stopChange = __privateGet(this, _state).onChange((event) => {
      if (name in event.net) redraw();
    });
    const stopPreview = __privateGet(this, _state).onPreview((changed) => {
      if (changed.includes(name)) redraw();
    });
    if (!source) redraw();
    const stop = () => {
      active = false;
      stopEngine?.();
      stopChange();
      stopPreview();
      __privateGet(this, _stops).delete(stop);
    };
    __privateGet(this, _stops).add(stop);
    return stop;
  }
  /**
   * Throws `INVALID_APP_STATE` if a written `fromQuery` key gains a value its domain query doesn't
   * return at `next`. Checked only when that result is cached; values already in `current` pass.
   */
  check(current, next, written) {
    for (const name of written) {
      const decl = __privateGet(this, _manifest).state?.[name];
      const source = decl?.domain?.fromQuery;
      if (!decl || !source || next[name] === void 0) continue;
      const result = __privateGet(this, _engine).peek(source.query, next);
      if (!result) continue;
      const allowed = new Set(choicesFrom(result, source.field).map((c) => JSON.stringify(c.value)));
      const before = new Set(itemsOf(current[name] ?? decl.default).map((v) => JSON.stringify(v)));
      for (const item of itemsOf(next[name])) {
        const id = JSON.stringify(item);
        if (!allowed.has(id) && !before.has(id)) {
          throw invalidState(name, `${format(item)} is not a ${source.field} that query ${source.query} returns`);
        }
      }
    }
  }
  /** Stops every domain subscription. */
  dispose() {
    for (const stop of [...__privateGet(this, _stops)]) stop();
  }
};
_manifest = new WeakMap();
_engine = new WeakMap();
_state = new WeakMap();
_stops = new WeakMap();
_Domains_instances = new WeakSet();
currentKey_fn = function(queryId) {
  try {
    return __privateGet(this, _engine).expansionKey(queryId, __privateGet(this, _state).values());
  } catch {
    return void 0;
  }
};
function choiceOf(member) {
  return isObject(member) ? { value: member.value, alias: member.alias } : { value: member };
}
function choicesFrom(result, field, alias) {
  const choices = [];
  const seen = /* @__PURE__ */ new Set();
  for (const row of result.data) {
    const value = row[field];
    if (value === null || value === void 0) continue;
    const id = JSON.stringify(value);
    if (seen.has(id)) continue;
    seen.add(id);
    const text = alias !== void 0 ? row[alias] : void 0;
    choices.push(text === null || text === void 0 ? { value } : { value, alias: String(text) });
  }
  return choices;
}
function itemsOf(value) {
  if (value === void 0) return [];
  return Array.isArray(value) ? value : [value];
}
function missingFrom(members, value) {
  const known = new Set(members.map((m) => JSON.stringify(m.value)));
  return itemsOf(value).filter((v) => !known.has(JSON.stringify(v)));
}

// src/engine.ts
var _ctx, _subscriptions, _pending, _previewOnly, _latestPreview, _flushScheduled, _forced, _running, _cache, _requestIds, _metadata, _disposed, _QueryEngine_instances, dependents_fn, unsubscribe_fn, cached_fn, dropPreview_fn, evict_fn, execute_fn, schedule_fn, run_fn2, runChanged_fn;
var QueryEngine = class {
  constructor(context) {
    __privateAdd(this, _QueryEngine_instances);
    __privateAdd(this, _ctx);
    __privateAdd(this, _subscriptions, /* @__PURE__ */ new Set());
    __privateAdd(this, _pending, /* @__PURE__ */ new Set());
    __privateAdd(this, _previewOnly, /* @__PURE__ */ new Set());
    __privateAdd(this, _latestPreview, /* @__PURE__ */ new Map());
    __privateAdd(this, _flushScheduled, false);
    __privateAdd(this, _forced, /* @__PURE__ */ new Set());
    __privateAdd(this, _running, /* @__PURE__ */ new Set());
    __privateAdd(this, _cache, /* @__PURE__ */ new Map());
    __privateAdd(this, _requestIds, 0);
    __privateAdd(this, _metadata, /* @__PURE__ */ new Map());
    __privateAdd(this, _disposed, false);
    __privateSet(this, _ctx, context);
  }
  /** Throws `APP_DISPOSED` once the app is disposed. */
  assertLive() {
    if (__privateGet(this, _disposed)) throw new DataAppError("APP_DISPOSED", "the app was disposed");
  }
  /** Dry run against current state plus `overrides`. Nothing is sent. */
  explain(queryId, overrides) {
    const { values: _values2, ...result } = explainDetail(__privateGet(this, _ctx).manifest, __privateGet(this, _ctx).provider.dialect, queryId, __privateGet(this, _ctx).state.values(), overrides);
    return result;
  }
  /** Identifies what `queryId` expands to at `values`; equal keys mean an equal request. Throws if it can't expand. */
  expansionKey(queryId, values) {
    return JSON.stringify(toExpansion(explainDetail(__privateGet(this, _ctx).manifest, __privateGet(this, _ctx).provider.dialect, queryId, values)));
  }
  /**
   * The cached, finished result of `queryId` at `values` without per-call options, or undefined if
   * there is none or the query can't expand there. Never sends a request.
   */
  peek(queryId, values) {
    let expansion;
    try {
      expansion = toExpansion(explainDetail(__privateGet(this, _ctx).manifest, __privateGet(this, _ctx).provider.dialect, queryId, values));
    } catch {
      return void 0;
    }
    if ("emptyResult" in expansion) return void 0;
    return __privateGet(this, _cache).get(cacheKey(queryId, expansion))?.result;
  }
  /** Counts `work` as running, so {@link settled} waits for it. */
  track(work) {
    const running = work.then(
      () => void 0,
      () => void 0
    ).finally(() => __privateGet(this, _running).delete(running));
    __privateGet(this, _running).add(running);
  }
  /** Asks the provider once per datasource and keeps the frozen answer until `refresh()`. */
  metadata(datasource) {
    const provider = __privateGet(this, _ctx).provider;
    if (!provider.datasourceMetadata) return Promise.reject(new DataAppError("UNSUPPORTED", "the provider can't describe datasources"));
    let metadata = __privateGet(this, _metadata).get(datasource.id);
    if (!metadata) {
      metadata = provider.datasourceMetadata(datasource).then(deepFreeze);
      metadata.catch(() => __privateGet(this, _metadata).get(datasource.id) === metadata && __privateGet(this, _metadata).delete(datasource.id));
      __privateGet(this, _metadata).set(datasource.id, metadata);
    }
    return metadata;
  }
  /** Expands `queryId` against the store (plus overrides) and runs it, or reuses a cached result. */
  async run(queryId, call) {
    for (const key of Object.keys(call.queryOptions ?? {})) {
      if (!__privateGet(this, _ctx).provider.dialect.callOptions.includes(key)) {
        throw new DataAppError("INVALID_QUERY_OPTION", `option ${key} cannot be passed per call; make it a $state placeholder in the template`, {
          queryId,
          reason: key
        });
      }
    }
    const { state, telemetry } = __privateGet(this, _ctx);
    const detail = explainDetail(__privateGet(this, _ctx).manifest, __privateGet(this, _ctx).provider.dialect, queryId, state.values(), call.overrides);
    const { signal } = call;
    signal?.throwIfAborted();
    const run = telemetry.beginRun(queryId, state.revision, "query", { caller: "query", view: call.view });
    const { promise, release, served, requestId } = __privateMethod(this, _QueryEngine_instances, cached_fn).call(this, queryId, toExpansion(detail), detail.values, call);
    run.served(served, requestId);
    promise.then(
      (result) => run.finish(result.emptyResult === true ? "empty" : "ok", result.data.length),
      (error) => run.finish("error", void 0, error)
    );
    if (!signal) return promise.then(ownCopy).finally(release);
    return new Promise((resolve, reject) => {
      const abort = () => {
        run.finish("cancelled");
        release();
        reject(signal.reason);
      };
      signal.addEventListener("abort", abort, { once: true });
      promise.then((result) => resolve(ownCopy(result)), reject).finally(() => {
        signal.removeEventListener("abort", abort);
        release();
      });
    });
  }
  /** Runs the spec's queries now and again whenever one of their expansions changes; returns a function that stops it. */
  subscribe(spec) {
    const { manifest, provider } = __privateGet(this, _ctx);
    const subscription = {
      ...spec,
      dependencies: new Set(spec.queryIds.flatMap((id) => referencedKeys(manifest, provider.dialect, id))),
      executions: /* @__PURE__ */ new Map(),
      sequence: 0,
      active: true,
      inFlight: false,
      rerun: false
    };
    __privateGet(this, _subscriptions).add(subscription);
    __privateMethod(this, _QueryEngine_instances, schedule_fn).call(this, [subscription]);
    return () => __privateMethod(this, _QueryEngine_instances, unsubscribe_fn).call(this, subscription);
  }
  /** Schedules every subscription that depends on one of `changed`. */
  onCommit(changed) {
    __privateMethod(this, _QueryEngine_instances, schedule_fn).call(this, __privateMethod(this, _QueryEngine_instances, dependents_fn).call(this, changed));
  }
  /** Schedules every subscription that depends on one of `changed` to follow a gesture's preview. */
  onPreview(changed) {
    __privateMethod(this, _QueryEngine_instances, schedule_fn).call(this, __privateMethod(this, _QueryEngine_instances, dependents_fn).call(this, changed), true);
  }
  /** A gesture ended: keeps the preview results still on screen as ordinary entries and re-runs what moved. */
  endPreview(changed) {
    __privateGet(this, _latestPreview).clear();
    for (const [key, entry] of __privateGet(this, _cache)) {
      if (!entry.preview) continue;
      if (entry.waiters > 0) entry.preview = false;
      else __privateGet(this, _cache).delete(key);
    }
    __privateMethod(this, _QueryEngine_instances, evict_fn).call(this);
    __privateMethod(this, _QueryEngine_instances, schedule_fn).call(this, __privateMethod(this, _QueryEngine_instances, dependents_fn).call(this, changed));
  }
  /** What the cache holds now. */
  cacheSummary() {
    let held = 0;
    let rows = 0;
    for (const entry of __privateGet(this, _cache).values()) {
      if (entry.waiters > 0) held++;
      rows += entry.result?.data.length ?? 0;
    }
    return { entries: __privateGet(this, _cache).size, limit: __privateGet(this, _ctx).cacheSize, held, rows };
  }
  /** Drops every cached result and metadata, and schedules every subscription to re-run in full. */
  invalidate() {
    __privateGet(this, _cache).clear();
    __privateGet(this, _metadata).clear();
    for (const s of __privateGet(this, _subscriptions)) __privateGet(this, _forced).add(s);
    __privateMethod(this, _QueryEngine_instances, schedule_fn).call(this, [...__privateGet(this, _subscriptions)]);
  }
  /** Resolves once queued writes have committed and every run they triggered has finished. */
  async settled() {
    const { state } = __privateGet(this, _ctx);
    for (; ; ) {
      await state.idle();
      await Promise.resolve();
      if (__privateGet(this, _running).size > 0) await Promise.all(__privateGet(this, _running));
      else if (__privateGet(this, _flushScheduled) || __privateGet(this, _pending).size > 0) await new Promise((resolve) => queueMicrotask(resolve));
      else if (!state.writing) return;
    }
  }
  /** Stops every subscription and cancels requests in flight. */
  dispose() {
    if (__privateGet(this, _disposed)) return;
    __privateSet(this, _disposed, true);
    for (const s of [...__privateGet(this, _subscriptions)]) __privateMethod(this, _QueryEngine_instances, unsubscribe_fn).call(this, s);
    for (const entry of __privateGet(this, _cache).values()) if (!entry.settled) entry.controller.abort();
    __privateGet(this, _cache).clear();
    __privateGet(this, _metadata).clear();
  }
};
_ctx = new WeakMap();
_subscriptions = new WeakMap();
_pending = new WeakMap();
_previewOnly = new WeakMap();
_latestPreview = new WeakMap();
_flushScheduled = new WeakMap();
_forced = new WeakMap();
_running = new WeakMap();
_cache = new WeakMap();
_requestIds = new WeakMap();
_metadata = new WeakMap();
_disposed = new WeakMap();
_QueryEngine_instances = new WeakSet();
dependents_fn = function(changed) {
  return [...__privateGet(this, _subscriptions)].filter((s) => changed.some((n) => s.dependencies.has(n)));
};
unsubscribe_fn = function(subscription) {
  subscription.active = false;
  __privateGet(this, _subscriptions).delete(subscription);
  __privateGet(this, _pending).delete(subscription);
  __privateGet(this, _previewOnly).delete(subscription);
  __privateGet(this, _forced).delete(subscription);
  for (const e of subscription.executions.values()) e.release();
  subscription.executions.clear();
};
/**
 * Same request (query and options), same result: concurrent and later callers share one request.
 * Each caller must call `release` once it no longer needs the result.
 */
cached_fn = function(queryId, expansion, values, call) {
  if ("emptyResult" in expansion) {
    const promise = __privateMethod(this, _QueryEngine_instances, execute_fn).call(this, queryId, expansion, values, call, new AbortController().signal);
    return { promise, release: () => {
    }, settled: true, served: "none" };
  }
  const key = cacheKey(queryId, expansion, call.queryOptions);
  let entry = __privateGet(this, _cache).get(key);
  let served;
  const preview = call.preview === true;
  if (entry) {
    served = entry.settled ? "cache" : "shared";
    if (!preview) entry.preview = false;
    __privateGet(this, _cache).delete(key);
    __privateGet(this, _cache).set(key, entry);
  } else {
    served = "request";
    const controller = new AbortController();
    const created = { id: ++__privateWrapper(this, _requestIds)._, queryId, preview, controller, waiters: 0, settled: false, promise: void 0 };
    created.promise = __privateMethod(this, _QueryEngine_instances, execute_fn).call(this, queryId, expansion, values, call, controller.signal);
    created.promise.then(
      (result) => {
        created.settled = true;
        created.result = result;
      },
      () => {
        created.settled = true;
        if (__privateGet(this, _cache).get(key) === created) __privateGet(this, _cache).delete(key);
      }
    );
    entry = created;
    __privateGet(this, _cache).set(key, entry);
    if (preview) {
      const prior = __privateGet(this, _latestPreview).get(queryId);
      __privateGet(this, _latestPreview).set(queryId, key);
      if (prior !== void 0 && prior !== key) __privateMethod(this, _QueryEngine_instances, dropPreview_fn).call(this, prior);
    }
  }
  const held = entry;
  held.waiters++;
  if (served === "request") __privateMethod(this, _QueryEngine_instances, evict_fn).call(this);
  let released = false;
  return {
    promise: held.promise,
    settled: held.settled,
    served,
    requestId: held.id,
    release: () => {
      if (released) return;
      released = true;
      if (--held.waiters > 0) return;
      if (!held.settled) {
        held.controller.abort();
        if (__privateGet(this, _cache).get(key) === held) __privateGet(this, _cache).delete(key);
      } else if (held.preview && __privateGet(this, _latestPreview).get(held.queryId) !== key) {
        __privateMethod(this, _QueryEngine_instances, dropPreview_fn).call(this, key);
      } else {
        __privateMethod(this, _QueryEngine_instances, evict_fn).call(this);
      }
    }
  };
};
dropPreview_fn = function(key) {
  const entry = __privateGet(this, _cache).get(key);
  if (entry?.preview && entry.waiters === 0) __privateGet(this, _cache).delete(key);
};
/** Drops results nothing holds, least recently used first, until at most `cacheSize` are left. */
evict_fn = function() {
  const past = (entry) => !entry.preview && entry.waiters === 0;
  let size = 0;
  for (const entry of __privateGet(this, _cache).values()) if (past(entry)) size++;
  for (const [key, entry] of __privateGet(this, _cache)) {
    if (size <= __privateGet(this, _ctx).cacheSize) return;
    if (!past(entry)) continue;
    __privateGet(this, _cache).delete(key);
    size--;
  }
};
execute_fn = async function(queryId, expansion, values, call, signal) {
  if ("emptyResult" in expansion) return { data: [], emptyResult: true };
  const { manifest, host, provider } = __privateGet(this, _ctx);
  const named = findQuery(manifest, queryId);
  const datasource = manifest.datasources?.find((d) => d.id === named.datasource) ?? { id: named.datasource };
  const attribution = {
    ...host?.packageId !== void 0 && { packageId: host.packageId },
    queryId,
    state: values,
    ...call.view !== void 0 && { view: call.view }
  };
  try {
    return await provider.query({ queryId, datasource, query: expansion.query, options: { ...expansion.options, ...call.queryOptions }, attribution, signal });
  } catch (error) {
    if (signal.aborted || error instanceof DataAppError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    throw new DataAppError("QUERY_FAILED", `query ${queryId}: ${message}`, { queryId, cause: error });
  }
};
/** Coalesces every subscription touched in this tick into one concurrent flush. */
schedule_fn = function(subscriptions, preview = false) {
  for (const s of subscriptions) {
    if (!preview) __privateGet(this, _previewOnly).delete(s);
    else if (!__privateGet(this, _pending).has(s)) __privateGet(this, _previewOnly).add(s);
    __privateGet(this, _pending).add(s);
  }
  if (__privateGet(this, _flushScheduled) || __privateGet(this, _pending).size === 0) return;
  __privateSet(this, _flushScheduled, true);
  queueMicrotask(() => {
    __privateSet(this, _flushScheduled, false);
    const batch = [...__privateGet(this, _pending)];
    __privateGet(this, _pending).clear();
    const store = __privateGet(this, _ctx).state.values();
    const revision = __privateGet(this, _ctx).state.revision;
    for (const s of batch) {
      const preview2 = __privateGet(this, _previewOnly).delete(s);
      if (preview2 && s.inFlight) {
        s.rerun = true;
        continue;
      }
      const forced = __privateGet(this, _forced).delete(s);
      const running = __privateMethod(this, _QueryEngine_instances, run_fn2).call(this, s, store, revision, forced, preview2).finally(() => __privateGet(this, _running).delete(running));
      __privateGet(this, _running).add(running);
    }
  });
};
run_fn2 = async function(subscription, store, revision, forced, preview) {
  const planned = subscription.queryIds.map((queryId) => {
    const detail = explainDetail(__privateGet(this, _ctx).manifest, __privateGet(this, _ctx).provider.dialect, queryId, store);
    const expansion = toExpansion(detail);
    return { queryId, detail, expansion, key: JSON.stringify(expansion) };
  });
  const trigger = forced ? "refresh" : subscription.sequence === 0 ? "subscribe" : preview ? "preview" : "change";
  const changed = forced ? planned : planned.filter((p) => subscription.executions.get(p.queryId)?.key !== p.key);
  if (changed.length === 0) return;
  subscription.inFlight = true;
  try {
    await __privateMethod(this, _QueryEngine_instances, runChanged_fn).call(this, subscription, changed, revision, trigger, preview);
  } finally {
    subscription.inFlight = false;
    if (subscription.rerun) {
      subscription.rerun = false;
      if (subscription.active) __privateMethod(this, _QueryEngine_instances, schedule_fn).call(this, [subscription], __privateGet(this, _ctx).state.previewing);
    }
  }
};
runChanged_fn = async function(subscription, changed, revision, trigger, preview) {
  const sequence = ++subscription.sequence;
  const isCurrent = () => subscription.active && sequence === subscription.sequence;
  for (const { queryId, detail, expansion, key } of changed) {
    const previous = subscription.executions.get(queryId);
    if (previous && !previous.done) {
      previous.done = true;
      const stale = () => previous.run.finish("stale");
      previous.promise.then(stale, stale);
    }
    const run = __privateGet(this, _ctx).telemetry.beginRun(queryId, revision, trigger, {
      caller: subscription.caller,
      view: subscription.renderedView ?? subscription.attributionView,
      key: subscription.stateKey
    });
    const { promise, release, settled, served, requestId } = __privateMethod(this, _QueryEngine_instances, cached_fn).call(this, queryId, expansion, detail.values, { view: subscription.attributionView, preview });
    previous?.release();
    run.served(served, requestId);
    promise.catch(() => void 0);
    subscription.executions.set(queryId, { key, promise, release, run, done: false });
    if (!settled) setStatus(subscription, "loading");
  }
  const executions = subscription.queryIds.map((id) => subscription.executions.get(id));
  const fresh = executions.filter((e) => !e.done);
  let rendering = false;
  try {
    const results = await Promise.all(executions.map((e) => e.promise));
    if (!isCurrent()) {
      if (!subscription.active) finishStale(fresh);
      return;
    }
    rendering = true;
    for (const e of fresh) e.run.rendering();
    await subscription.deliver(
      results.map(ownCopy),
      executions.map((e) => e.key)
    );
    if (isCurrent()) setStatus(subscription, "ready");
    for (const e of fresh) {
      const result = results[executions.indexOf(e)];
      e.done = true;
      e.run.finish(result.emptyResult === true ? "empty" : "ok", result.data.length);
    }
  } catch (error) {
    if (!rendering && !isCurrent()) {
      if (!subscription.active) finishStale(fresh);
      return;
    }
    for (const e of fresh) {
      if (e.done) continue;
      e.done = true;
      e.run.finish("error", void 0, error);
    }
    if (!rendering) {
      for (const [id, e] of subscription.executions) {
        if (!fresh.includes(e)) continue;
        subscription.executions.delete(id);
        e.release();
      }
    }
    if (isCurrent()) setStatus(subscription, "error");
    if (subscription.onError) subscription.onError(error);
    else console.error(`[data-app] subscription to ${subscription.label} failed`, error);
  }
};
function cacheKey(queryId, expansion, callOptions) {
  return JSON.stringify([queryId, expansion.query, { ...expansion.options, ...callOptions }]);
}
function setStatus(subscription, status) {
  if (subscription.status === status) return;
  subscription.status = status;
  try {
    subscription.onStatus?.(status);
  } catch (error) {
    console.error(`[data-app] onStatus for ${subscription.label} failed`, error);
  }
}
function ownCopy(result) {
  return { ...result, data: [...result.data] };
}
function deepFreeze(value) {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value)) deepFreeze(v);
  }
  return value;
}
function finishStale(executions) {
  for (const e of executions) {
    if (e.done) continue;
    e.done = true;
    e.run.finish("stale");
  }
}

// src/handles.ts
var _engine2;
var ViewHandle = class {
  /** @internal */
  constructor(declaration, engine) {
    /** The view's id. */
    __publicField(this, "id");
    /** The view's manifest declaration. */
    __publicField(this, "declaration");
    __privateAdd(this, _engine2);
    this.id = declaration.id;
    this.declaration = declaration;
    __privateSet(this, _engine2, engine);
  }
  /**
   * Runs the view's `queries` now and again whenever one of their expansions changes, and calls
   * back with the latest result of each once all of them are in. Returns a function that stops it.
   */
  render(callback, options = {}) {
    __privateGet(this, _engine2).assertLive();
    const queryIds = [...this.declaration.queries];
    return __privateGet(this, _engine2).subscribe({
      label: `view ${this.id}`,
      queryIds,
      caller: "render",
      renderedView: this.id,
      deliver: (results) => callback(Object.fromEntries(queryIds.map((id, i) => [id, results[i]]))),
      onError: options.onError,
      onStatus: options.onStatus
    });
  }
};
_engine2 = new WeakMap();
var _engine3;
var QueryHandle = class {
  /** @internal */
  constructor(declaration, engine) {
    /** The query's id. */
    __publicField(this, "id");
    /** The query's manifest declaration. */
    __publicField(this, "declaration");
    __privateAdd(this, _engine3);
    this.id = declaration.id;
    this.declaration = declaration;
    __privateSet(this, _engine3, engine);
  }
  /** Expands the query against the store (plus overrides) and runs it once, or reuses a cached result. */
  async run(options = {}) {
    __privateGet(this, _engine3).assertLive();
    return __privateGet(this, _engine3).run(this.id, options);
  }
  /**
   * Runs the query now and re-runs it whenever its resolved expansion changes, whatever the source.
   * For a query no view draws; use `app.view(id).render` for one that does. Returns an unsubscribe function.
   */
  subscribe(callback, options = {}) {
    __privateGet(this, _engine3).assertLive();
    return __privateGet(this, _engine3).subscribe({
      label: `query ${this.id}`,
      queryIds: [this.id],
      caller: "subscribe",
      attributionView: options.view,
      deliver: ([result]) => callback(result),
      onError: options.onError,
      onStatus: options.onStatus
    });
  }
  /** Dry run: the expanded query, what was omitted and why, against current state plus `overrides`. Nothing is sent. */
  explain(options = {}) {
    return __privateGet(this, _engine3).explain(this.id, options.overrides);
  }
};
_engine3 = new WeakMap();
var _engine4;
var DatasourceHandle = class {
  /** @internal */
  constructor(declaration, engine) {
    /** The datasource's manifest id. */
    __publicField(this, "id");
    /** The datasource's manifest declaration. */
    __publicField(this, "declaration");
    __privateAdd(this, _engine4);
    this.id = declaration.id;
    this.declaration = declaration;
    __privateSet(this, _engine4, engine);
  }
  /**
   * Fields and their types. The provider is asked once and the answer, frozen, is kept until
   * `app.refresh()`; nothing is requested unless the app calls this. Rejects with `UNSUPPORTED`
   * if the provider can't describe datasources.
   */
  async metadata() {
    __privateGet(this, _engine4).assertLive();
    return __privateGet(this, _engine4).metadata(this.declaration);
  }
};
_engine4 = new WeakMap();

// src/net.ts
function difference(a, b) {
  return a.filter((x) => !b.some((y) => deepEqual(x, y))).map(clone);
}
function netChange(decl, from, to) {
  if (deepEqual(from, to)) return void 0;
  const cardinality = decl ? cardinalityOf(decl) : "single";
  if (from === void 0) return { kind: cardinality === "tuples" ? "selected" : "set", to: clone(to) };
  if (to === void 0) return { kind: "cleared", from: clone(from) };
  switch (cardinality) {
    case "list": {
      const added = difference(to, from);
      const removed = difference(from, to);
      if (added.length > 0 && removed.length === 0) return { kind: "added", from: clone(from), to: clone(to), added };
      if (removed.length > 0 && added.length === 0) return { kind: "removed", from: clone(from), to: clone(to), removed };
      return { kind: "replaced", from: clone(from), to: clone(to), added, removed };
    }
    case "range": {
      const a = from;
      const b = to;
      const minCmp = compareScalars(b.min, a.min);
      const maxCmp = compareScalars(b.max, a.max);
      const kind = minCmp >= 0 && maxCmp <= 0 ? "narrowed" : minCmp <= 0 && maxCmp >= 0 ? "widened" : "shifted";
      return { kind, from: clone(from), to: clone(to) };
    }
    case "tuples":
      return {
        kind: "changed",
        from: clone(from),
        to: clone(to),
        added: difference(to, from),
        removed: difference(from, to)
      };
    case "single":
      return { kind: "changed", from: clone(from), to: clone(to) };
  }
}
function netBetween(manifest, before, after, names = /* @__PURE__ */ new Set([...Object.keys(before), ...Object.keys(after)])) {
  const net = {};
  for (const name of names) {
    const change = netChange(manifest.state?.[name], before[name], after[name]);
    if (change) net[name] = change;
  }
  return net;
}

// src/host-bridge.ts
var STATE_CHANGED_INTERVAL_MS = 100;
function connectHost(app, host, hooks) {
  const reporter = new StateReporter(app, host, hooks.now);
  host.onRequest((request) => handleHostRequest(app, request, hooks));
  reporter.notify();
  return reporter;
}
async function handleHostRequest(app, request, hooks) {
  hooks.assertLive();
  const { state } = app;
  switch (request.type) {
    case "getSnapshot":
      return app.getSnapshot();
    case "applySnapshot":
      return { revision: await state.restore(request.snapshot.state ?? {}) };
    case "applyChanges":
      return { revision: await state.applyChanges(request.changes, request.options) };
    case "undo":
      return { revision: await state.undo() ?? state.revision };
    case "redo":
      return { revision: await state.redo() ?? state.revision };
    case "changesSince": {
      const result = state.changesSince(request.revision, request.options);
      return "resync" in result ? { resync: true, snapshot: app.getSnapshot() } : result;
    }
    case "explain":
      return app.query(request.queryId).explain(request.options);
    case "refresh":
      await app.refresh();
      return { revision: state.revision };
    case "inspect":
      hooks.applyInspecting(request.inspecting ?? !app.inspecting);
      return { inspecting: app.inspecting };
    default:
      throw new DataAppError("INVALID_HOST_REQUEST", `unknown host request ${request.type}`);
  }
}
var _lastSentAt, _timer, _delivered, _source, _stopped, _StateReporter_instances, send_fn, agentVisible_fn;
var StateReporter = class {
  constructor(app, host, now) {
    __publicField(this, "app", app);
    __publicField(this, "host", host);
    __publicField(this, "now", now);
    __privateAdd(this, _StateReporter_instances);
    __privateAdd(this, _lastSentAt, -Infinity);
    __privateAdd(this, _timer);
    __privateAdd(this, _delivered);
    __privateAdd(this, _source, "app");
    __privateAdd(this, _stopped, false);
    __privateSet(this, _delivered, __privateMethod(this, _StateReporter_instances, agentVisible_fn).call(this, app.state.committedValues()));
  }
  stop() {
    clearTimeout(__privateGet(this, _timer));
    __privateSet(this, _timer, void 0);
    __privateSet(this, _stopped, true);
  }
  notify(source) {
    if (__privateGet(this, _stopped)) return;
    if (source) __privateSet(this, _source, source);
    if (__privateGet(this, _timer) !== void 0) return;
    const wait = __privateGet(this, _lastSentAt) + STATE_CHANGED_INTERVAL_MS - this.now();
    if (wait <= 0) __privateMethod(this, _StateReporter_instances, send_fn).call(this);
    else __privateSet(this, _timer, setTimeout(() => __privateMethod(this, _StateReporter_instances, send_fn).call(this), wait));
  }
};
_lastSentAt = new WeakMap();
_timer = new WeakMap();
_delivered = new WeakMap();
_source = new WeakMap();
_stopped = new WeakMap();
_StateReporter_instances = new WeakSet();
send_fn = function() {
  __privateSet(this, _timer, void 0);
  __privateSet(this, _lastSentAt, this.now());
  const snapshot = this.app.getSnapshot();
  const visible = __privateMethod(this, _StateReporter_instances, agentVisible_fn).call(this, this.app.state.committedValues());
  const message = {
    revision: snapshot.revision ?? 0,
    source: __privateGet(this, _source),
    net: netBetween(this.app.manifest, __privateGet(this, _delivered), visible),
    snapshot,
    canUndo: this.app.state.canUndo,
    canRedo: this.app.state.canRedo
  };
  __privateSet(this, _delivered, visible);
  this.host.reportState(message);
};
agentVisible_fn = function(values) {
  return Object.fromEntries(Object.entries(values).filter(([name]) => this.app.state.visibleToAgents(name)));
};

// src/inspect.ts
var VIEW_ATTRIBUTE = "data-app-view";
function installInspector(app, factory, options = {}) {
  const doc = options.document ?? globalThis.document;
  if (!doc) return () => {
  };
  const timeline = new Timeline(app.state.revision, options.history);
  const lastRuns = /* @__PURE__ */ new Map();
  const listeners = /* @__PURE__ */ new Set();
  const notify = () => {
    for (const listener of listeners) guard("update listener", listener);
  };
  const context = {
    app,
    document: doc,
    timeline,
    lastRun: (queryId) => lastRuns.get(queryId),
    cache: options.cache ?? (() => ({ entries: 0, limit: 0, held: 0, rows: 0 })),
    viewElements: () => Array.from(doc.querySelectorAll(`[${VIEW_ATTRIBUTE}]`)).map((element) => ({ viewId: element.getAttribute(VIEW_ATTRIBUTE) ?? "", element })),
    onUpdate(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    exit: () => app.setInspecting(false)
  };
  const offTelemetry = app.onTelemetry((event) => {
    timeline.add(event);
    if (event.type === "run" && event.outcome !== "stale" && event.caller !== "query") lastRuns.set(event.queryId, event);
    notify();
  });
  const offState = app.state.onChange((event) => {
    timeline.commit(event.revision, event.source);
    notify();
  });
  const onKey = (event) => {
    if (!event.altKey || !event.shiftKey || event.code !== "KeyI") return;
    event.preventDefault();
    app.setInspecting(!app.inspecting);
  };
  doc.addEventListener("keydown", onKey);
  let inspector;
  guard("inspector", () => {
    inspector = factory(context);
  });
  const offInspect = app.onInspectChange((on) => guard("inspector", () => on ? inspector?.open() : inspector?.close()));
  if (app.inspecting) guard("inspector", () => inspector?.open());
  return () => {
    offTelemetry();
    offState();
    offInspect();
    doc.removeEventListener("keydown", onKey);
    listeners.clear();
    guard("inspector", () => {
      if (app.inspecting) inspector?.close();
      inspector?.dispose?.();
    });
  };
}
function guard(what, fn) {
  try {
    fn();
  } catch (error) {
    console.error(`[data-app] ${what} failed`, error);
  }
}

// src/store.ts
var _manifest2, _dialect, _now, _maxLogEntries, _maxLogAgeMs, _values, _revision, _logBase, _log, _undo, _redo, _queue, _queuedWrites, _committing, _listeners, _domains, _gesture, _previewListeners, _StateStore_instances, effective_fn, preview_fn, endGesture_fn, interruptGesture_fn, notifyPreview_fn, decl_fn, behavior_fn, enqueue_fn, validate_fn, diff_fn, endpoint_fn, write_fn, record_fn, commit_fn, prune_fn;
var StateStore = class {
  /** Usually created by {@link createDataApp}; `dialect` is used to validate values against templates. @internal */
  constructor(manifest, dialect, options = {}) {
    __privateAdd(this, _StateStore_instances);
    __privateAdd(this, _manifest2);
    __privateAdd(this, _dialect);
    __privateAdd(this, _now);
    __privateAdd(this, _maxLogEntries);
    __privateAdd(this, _maxLogAgeMs);
    __privateAdd(this, _values);
    __privateAdd(this, _revision);
    __privateAdd(this, _logBase);
    __privateAdd(this, _log, []);
    __privateAdd(this, _undo, []);
    __privateAdd(this, _redo, []);
    __privateAdd(this, _queue, Promise.resolve());
    __privateAdd(this, _queuedWrites, 0);
    __privateAdd(this, _committing, false);
    __privateAdd(this, _listeners, /* @__PURE__ */ new Set());
    __privateAdd(this, _domains);
    __privateAdd(this, _gesture);
    __privateAdd(this, _previewListeners, /* @__PURE__ */ new Set());
    __privateSet(this, _manifest2, manifest);
    __privateSet(this, _dialect, dialect);
    __privateSet(this, _now, options.now ?? Date.now);
    __privateSet(this, _maxLogEntries, options.maxLogEntries ?? 1e3);
    __privateSet(this, _maxLogAgeMs, options.maxLogAgeMs ?? 15 * 60 * 1e3);
    __privateSet(this, _values, sanitizeState(manifest, options.initial?.state));
    __privateSet(this, _revision, options.initial?.revision ?? 0);
    __privateSet(this, _logBase, __privateGet(this, _revision));
  }
  /** Connects domain subscriptions and the domain check on writes. @internal */
  useDomains(domains) {
    __privateSet(this, _domains, domains);
  }
  /** The current revision; each committed write adds one. */
  get revision() {
    return __privateGet(this, _revision);
  }
  /** Whether {@link undo} has a step to undo. */
  get canUndo() {
    return __privateGet(this, _undo).length > 0;
  }
  /** Whether {@link redo} has a step to redo. */
  get canRedo() {
    return __privateGet(this, _redo).length > 0;
  }
  /** Explicitly set values of declared keys, including an open gesture's preview. */
  values() {
    return clone(__privateMethod(this, _StateStore_instances, effective_fn).call(this));
  }
  /** Committed values only, without a gesture's preview: what the host and agents see. @internal */
  committedValues() {
    return clone(__privateGet(this, _values));
  }
  /** Whether a gesture is open. @internal */
  get previewing() {
    return __privateGet(this, _gesture) !== void 0;
  }
  /** Calls `listener` when a gesture's preview changes or the gesture ends. @internal */
  onPreview(listener) {
    __privateGet(this, _previewListeners).add(listener);
    return () => __privateGet(this, _previewListeners).delete(listener);
  }
  /**
   * Starts a gesture such as a drag: its `set` calls preview values that `key.value`, `values()` and
   * queries see at once, and `commit()` records them as one write and one undo step. Starting
   * another gesture commits this one first.
   */
  gesture(options = {}) {
    if (__privateGet(this, _gesture)) void __privateGet(this, _gesture).handle.commit();
    const handle = new Gesture({
      active: () => __privateGet(this, _gesture)?.handle === handle,
      set: (values) => __privateMethod(this, _StateStore_instances, preview_fn).call(this, values),
      commit: () => __privateMethod(this, _StateStore_instances, endGesture_fn).call(this, true),
      cancel: () => void __privateMethod(this, _StateStore_instances, endGesture_fn).call(this, false)
    });
    __privateSet(this, _gesture, { handle, updates: {}, options });
    return handle;
  }
  /** What snapshots persist: explicitly set values of declared keys with persist true. @internal */
  persistedValues() {
    return Object.fromEntries(Object.entries(clone(__privateGet(this, _values))).filter(([name]) => __privateMethod(this, _StateStore_instances, behavior_fn).call(this, name)?.persist));
  }
  /** Whether agents may read and write the key (its declaration's `agents`). @internal */
  visibleToAgents(name) {
    return __privateMethod(this, _StateStore_instances, behavior_fn).call(this, name)?.agents ?? false;
  }
  /** The state key the manifest declares as `name`, to read or write. Throws `UNKNOWN_STATE_KEY` if there is none. */
  key(name) {
    const declaration = __privateMethod(this, _StateStore_instances, decl_fn).call(this, name);
    if (!declaration) throw unknownStateKey(name);
    return new StateKeyHandle(name, declaration, {
      value: () => clone(__privateMethod(this, _StateStore_instances, effective_fn).call(this)[name] ?? declaration.default),
      isSet: () => name in __privateMethod(this, _StateStore_instances, effective_fn).call(this),
      set: (value, options) => this.set({ [name]: value }, options),
      subscribeDomain: (callback, options) => {
        if (!__privateGet(this, _domains)) throw new DataAppError("UNSUPPORTED", "subscribeDomain needs a store created by createDataApp");
        return __privateGet(this, _domains).subscribe(name, declaration, callback, options);
      }
    });
  }
  /** Calls `listener` after every committed revision, whatever the source; returns a function that removes it. */
  onChange(listener) {
    __privateGet(this, _listeners).add(listener);
    return () => __privateGet(this, _listeners).delete(listener);
  }
  /**
   * Sets keys in one revision; an `undefined` value unsets. Throws `UNKNOWN_STATE_KEY` or
   * `INVALID_APP_STATE` on a bad write. Commits immediately unless a transaction is still running,
   * and resolves to the new revision.
   */
  set(values, options = {}) {
    __privateMethod(this, _StateStore_instances, validate_fn).call(this, values);
    if (__privateGet(this, _domains)) {
      const next = { ...__privateGet(this, _values) };
      for (const [name, value] of Object.entries(values)) {
        if (value === void 0) delete next[name];
        else next[name] = value;
      }
      __privateGet(this, _domains).check(__privateGet(this, _values), next, Object.keys(values));
    }
    const commit = () => {
      const changes = __privateMethod(this, _StateStore_instances, diff_fn).call(this, Object.keys(values), { ...__privateGet(this, _values), ...values });
      return __privateMethod(this, _StateStore_instances, write_fn).call(this, changes, { source: "app", ...options });
    };
    if (__privateGet(this, _queuedWrites) > 0 || __privateGet(this, _committing)) return __privateMethod(this, _StateStore_instances, enqueue_fn).call(this, commit);
    __privateSet(this, _committing, true);
    try {
      return Promise.resolve(commit());
    } finally {
      __privateSet(this, _committing, false);
    }
  }
  /** Returns keys to their default ("no filter"), like {@link StateStore.set}. Resolves to the new revision. */
  unset(names, options = {}) {
    const list = Array.isArray(names) ? names : [names];
    return this.set(Object.fromEntries(list.map((n) => [n, void 0])), options);
  }
  /** Several set/unset calls committed as one revision; nothing is committed if `fn` throws. */
  transaction(fn, options = {}) {
    return __privateMethod(this, _StateStore_instances, enqueue_fn).call(this, async () => {
      const draft = clone(__privateGet(this, _values));
      const touched = /* @__PURE__ */ new Set();
      const apply = (values) => {
        __privateMethod(this, _StateStore_instances, validate_fn).call(this, values);
        for (const [name, value] of Object.entries(values)) {
          touched.add(name);
          if (value === void 0) delete draft[name];
          else draft[name] = clone(value);
        }
      };
      await fn({
        set: apply,
        unset: (names) => apply(Object.fromEntries([names].flat().map((n) => [n, void 0]))),
        get: (name) => {
          const decl = __privateMethod(this, _StateStore_instances, decl_fn).call(this, name);
          if (!decl) throw unknownStateKey(name);
          return clone(draft[name] ?? decl.default);
        }
      });
      __privateGet(this, _domains)?.check(__privateGet(this, _values), draft, touched);
      return __privateMethod(this, _StateStore_instances, write_fn).call(this, __privateMethod(this, _StateStore_instances, diff_fn).call(this, touched, draft), { source: "app", ...options });
    });
  }
  /** Host-delivered writes (agents). `ifRevision` guards against stale writers. @internal */
  applyChanges(changes, options = {}) {
    __privateMethod(this, _StateStore_instances, interruptGesture_fn).call(this);
    return __privateMethod(this, _StateStore_instances, enqueue_fn).call(this, () => {
      const source = options.source ?? "agent";
      if (source !== "agent") throw new DataAppError("INVALID_HOST_REQUEST", `unsupported applyChanges source ${source}`);
      if (options.ifRevision !== void 0 && options.ifRevision !== __privateGet(this, _revision)) {
        throw new DataAppError("REVISION_CONFLICT", `expected revision ${options.ifRevision}, store is at ${__privateGet(this, _revision)}`, {
          current: __privateGet(this, _revision)
        });
      }
      for (const { key } of changes) {
        if (!__privateMethod(this, _StateStore_instances, decl_fn).call(this, key)) throw unknownStateKey(key);
        if (!this.visibleToAgents(key)) throw invalidState(key, "not writable by agents (agents: false)");
      }
      const next = { ...__privateGet(this, _values) };
      for (const change of changes) {
        if ("to" in change && change.to !== void 0) next[change.key] = change.to;
        else delete next[change.key];
      }
      const touched = changes.map((c) => c.key);
      __privateMethod(this, _StateStore_instances, validate_fn).call(this, Object.fromEntries(touched.filter((n) => n in next).map((n) => [n, next[n]])));
      __privateGet(this, _domains)?.check(__privateGet(this, _values), next, touched);
      const { label, view } = options;
      return __privateMethod(this, _StateStore_instances, write_fn).call(this, __privateMethod(this, _StateStore_instances, diff_fn).call(this, touched, next), { source, label, view });
    });
  }
  /** Replaces the persisted keys with tolerant restore rules, as one `restore` transaction. @internal */
  restore(state) {
    __privateMethod(this, _StateStore_instances, interruptGesture_fn).call(this);
    return __privateMethod(this, _StateStore_instances, enqueue_fn).call(this, () => {
      const next = Object.fromEntries(Object.entries(__privateGet(this, _values)).filter(([name]) => !__privateMethod(this, _StateStore_instances, behavior_fn).call(this, name)?.persist));
      Object.assign(next, sanitizeState(__privateGet(this, _manifest2), state));
      return __privateMethod(this, _StateStore_instances, write_fn).call(this, __privateMethod(this, _StateStore_instances, diff_fn).call(this, [...Object.keys(__privateGet(this, _values)), ...Object.keys(next)], next), { source: "restore" });
    });
  }
  /** Applies the inverse of the most recent step as a new `undo` transaction; undefined if there is none. */
  undo() {
    __privateMethod(this, _StateStore_instances, interruptGesture_fn).call(this);
    return __privateMethod(this, _StateStore_instances, enqueue_fn).call(this, () => {
      const entry = __privateGet(this, _undo).pop();
      if (!entry) return void 0;
      const target = { ...__privateMethod(this, _StateStore_instances, endpoint_fn).call(this, entry.changes, "from"), ...entry.context };
      const revision = __privateMethod(this, _StateStore_instances, commit_fn).call(this, __privateMethod(this, _StateStore_instances, diff_fn).call(this, Object.keys(target), target), { source: "undo", undoes: entry.revision }, () => __privateGet(this, _redo).push(entry));
      if (revision === void 0) __privateGet(this, _redo).push(entry);
      return revision;
    });
  }
  /** Re-applies the most recently undone step as a new `redo` transaction; undefined if there is none. */
  redo() {
    __privateMethod(this, _StateStore_instances, interruptGesture_fn).call(this);
    return __privateMethod(this, _StateStore_instances, enqueue_fn).call(this, () => {
      const entry = __privateGet(this, _redo).pop();
      if (!entry) return void 0;
      const target = { ...__privateMethod(this, _StateStore_instances, endpoint_fn).call(this, entry.changes, "to"), ...entry.context };
      return __privateMethod(this, _StateStore_instances, commit_fn).call(this, __privateMethod(this, _StateStore_instances, diff_fn).call(this, Object.keys(target), target), { source: "redo", undoes: entry.revision }, (revision) => {
        __privateGet(this, _undo).push({ ...entry, revision, source: "redo", at: __privateGet(this, _now).call(this) });
      });
    });
  }
  /** The agent change feed after `since`; `{resync: true}` when the cursor is outside the retained log. */
  changesSince(since, options = {}) {
    __privateMethod(this, _StateStore_instances, prune_fn).call(this);
    if (!Number.isInteger(since) || since < __privateGet(this, _logBase) || since > __privateGet(this, _revision)) return { resync: true };
    const entries = __privateGet(this, _log).filter((e) => e.transaction.revision > since).map((e) => ({ ...e.transaction, changes: e.transaction.changes.filter((c) => this.visibleToAgents(c.key)) })).filter((t) => t.changes.length > 0);
    const before = this.stateAt(since);
    const order = new Set(entries.flatMap((t) => t.changes.map((c) => c.key)));
    const net = netBetween(__privateGet(this, _manifest2), before, __privateGet(this, _values), order);
    const affectedQueries = [];
    for (const named of __privateGet(this, _manifest2).queries ?? []) {
      const changedBy = referencedKeys(__privateGet(this, _manifest2), __privateGet(this, _dialect), named.id).filter((n) => n in net);
      if (changedBy.length === 0) continue;
      const a = safeExpand(__privateGet(this, _manifest2), __privateGet(this, _dialect), named.id, before);
      const b = safeExpand(__privateGet(this, _manifest2), __privateGet(this, _dialect), named.id, __privateGet(this, _values));
      if (deepEqual(a, b)) continue;
      affectedQueries.push(options.includeQueries ? { query: named.id, changedBy, before: a, after: b } : { query: named.id, changedBy });
    }
    return { fromRevision: since, revision: __privateGet(this, _revision), log: clone(entries), net, affectedQueries };
  }
  /** Explicit values of declared keys at a retained revision, reconstructed from the log. @internal */
  stateAt(revision) {
    const state = clone(__privateGet(this, _values));
    for (const { transaction } of [...__privateGet(this, _log)].reverse()) {
      if (transaction.revision <= revision) break;
      for (const change of transaction.changes) {
        if ("from" in change && change.from !== void 0) state[change.key] = clone(change.from);
        else delete state[change.key];
      }
    }
    return state;
  }
  /** True while a write is queued or running. @internal */
  get writing() {
    return __privateGet(this, _queuedWrites) > 0;
  }
  /** Resolves once every write queued so far has committed or failed. @internal */
  idle() {
    return __privateGet(this, _queue).then(() => void 0);
  }
};
_manifest2 = new WeakMap();
_dialect = new WeakMap();
_now = new WeakMap();
_maxLogEntries = new WeakMap();
_maxLogAgeMs = new WeakMap();
_values = new WeakMap();
_revision = new WeakMap();
_logBase = new WeakMap();
_log = new WeakMap();
_undo = new WeakMap();
_redo = new WeakMap();
_queue = new WeakMap();
_queuedWrites = new WeakMap();
_committing = new WeakMap();
_listeners = new WeakMap();
_domains = new WeakMap();
_gesture = new WeakMap();
_previewListeners = new WeakMap();
_StateStore_instances = new WeakSet();
effective_fn = function() {
  return __privateGet(this, _gesture) ? applyUpdates(__privateGet(this, _values), __privateGet(this, _gesture).updates) : __privateGet(this, _values);
};
preview_fn = function(values) {
  const gesture = __privateGet(this, _gesture);
  __privateMethod(this, _StateStore_instances, validate_fn).call(this, values);
  const current = __privateMethod(this, _StateStore_instances, effective_fn).call(this);
  const next = applyUpdates(current, values);
  __privateGet(this, _domains)?.check(current, next, Object.keys(values));
  const changed = Object.keys(values).filter((name) => !deepEqual(current[name], next[name]));
  for (const [name, value] of Object.entries(values)) gesture.updates[name] = clone(value);
  if (changed.length > 0) __privateMethod(this, _StateStore_instances, notifyPreview_fn).call(this, changed, false);
};
endGesture_fn = function(commit) {
  const gesture = __privateGet(this, _gesture);
  __privateSet(this, _gesture, void 0);
  const touched = Object.keys(gesture.updates);
  __privateMethod(this, _StateStore_instances, notifyPreview_fn).call(this, touched, true);
  if (!commit || __privateMethod(this, _StateStore_instances, diff_fn).call(this, touched, applyUpdates(__privateGet(this, _values), gesture.updates)).length === 0) return Promise.resolve(void 0);
  const { onCancel: _onCancel, ...options } = gesture.options;
  return this.set(gesture.updates, options);
};
interruptGesture_fn = function() {
  const gesture = __privateGet(this, _gesture);
  if (!gesture) return;
  void __privateMethod(this, _StateStore_instances, endGesture_fn).call(this, false);
  try {
    gesture.options.onCancel?.();
  } catch (error) {
    console.error("[data-app] gesture onCancel failed", error);
  }
};
notifyPreview_fn = function(changed, ended) {
  for (const listener of __privateGet(this, _previewListeners)) {
    try {
      listener(changed, ended);
    } catch (error) {
      console.error("[data-app] preview listener failed", error);
    }
  }
};
decl_fn = function(name) {
  return __privateGet(this, _manifest2).state?.[name];
};
behavior_fn = function(name) {
  const decl = __privateMethod(this, _StateStore_instances, decl_fn).call(this, name);
  return decl && behaviorOf(decl);
};
enqueue_fn = function(fn) {
  __privateWrapper(this, _queuedWrites)._++;
  const result = __privateGet(this, _queue).then(fn).finally(() => __privateWrapper(this, _queuedWrites)._--);
  __privateSet(this, _queue, result.catch(() => void 0));
  return result;
};
validate_fn = function(values) {
  for (const [name, value] of Object.entries(values)) {
    const decl = __privateMethod(this, _StateStore_instances, decl_fn).call(this, name);
    if (!decl) throw unknownStateKey(name);
    if (value === void 0) continue;
    const reason = checkStateValue(decl, value);
    if (reason) {
      if (decl.dataType === "JSON" && jsonSize(value) > JSON_KEY_LIMIT_BYTES) {
        throw new DataAppError("STATE_TOO_LARGE", `state key ${name}: ${reason}`, { key: name, reason });
      }
      throw invalidState(name, reason);
    }
  }
};
diff_fn = function(names, next) {
  const changes = [];
  for (const name of new Set(names)) {
    const from = __privateGet(this, _values)[name];
    const to = next[name];
    if (deepEqual(from, to)) continue;
    const change = { key: name };
    if (from !== void 0) change.from = clone(from);
    if (to !== void 0) change.to = clone(to);
    changes.push(change);
  }
  return changes;
};
endpoint_fn = function(changes, side) {
  return Object.fromEntries(changes.map((c) => [c.key, clone(c[side])]));
};
/** Commits a non-history write and records it for undo. */
write_fn = function(changes, meta) {
  const revision = __privateMethod(this, _StateStore_instances, commit_fn).call(this, changes, meta, (revision2) => __privateMethod(this, _StateStore_instances, record_fn).call(this, changes, meta.source, revision2));
  return revision ?? __privateGet(this, _revision);
};
/** Only changes to `step` keys make an undo step; context keys changed alongside ride with it. */
record_fn = function(allChanges, source, revision) {
  if (!allChanges.some((c) => __privateMethod(this, _StateStore_instances, behavior_fn).call(this, c.key)?.undo === "step")) return;
  const changes = allChanges.filter((c) => __privateMethod(this, _StateStore_instances, behavior_fn).call(this, c.key)?.undo !== "none");
  const context = {};
  for (const [name, decl] of Object.entries(__privateGet(this, _manifest2).state ?? {})) {
    if (behaviorOf(decl).undo !== "context" || changes.some((c) => c.key === name)) continue;
    context[name] = clone(__privateGet(this, _values)[name]);
  }
  __privateGet(this, _redo).length = 0;
  __privateGet(this, _undo).push({ revision, source, changes: clone(changes), context, at: __privateGet(this, _now).call(this) });
};
commit_fn = function(changes, meta, recordHistory) {
  if (changes.length === 0) return void 0;
  const now = __privateGet(this, _now).call(this);
  const revision = ++__privateWrapper(this, _revision)._;
  for (const change of changes) {
    if (change.to !== void 0) __privateGet(this, _values)[change.key] = clone(change.to);
    else delete __privateGet(this, _values)[change.key];
  }
  const transaction = {
    revision,
    time: new Date(now).toISOString(),
    source: meta.source,
    ...meta.label !== void 0 && { label: meta.label },
    ...meta.view !== void 0 && { view: meta.view },
    ...meta.undoes !== void 0 && { undoes: meta.undoes },
    changes
  };
  __privateGet(this, _log).push({ transaction, at: now });
  __privateMethod(this, _StateStore_instances, prune_fn).call(this);
  recordHistory(revision);
  const event = {
    revision,
    source: meta.source,
    net: netBetween(
      __privateGet(this, _manifest2),
      __privateMethod(this, _StateStore_instances, endpoint_fn).call(this, changes, "from"),
      __privateMethod(this, _StateStore_instances, endpoint_fn).call(this, changes, "to"),
      changes.map((c) => c.key)
    ),
    transaction: clone(transaction)
  };
  for (const listener of __privateGet(this, _listeners)) {
    try {
      listener(event);
    } catch (error) {
      console.error("[data-app] onChange listener failed", error);
    }
  }
  return revision;
};
prune_fn = function() {
  const oldest = __privateGet(this, _now).call(this) - __privateGet(this, _maxLogAgeMs);
  while (__privateGet(this, _log).length > 0 && (__privateGet(this, _log).length > __privateGet(this, _maxLogEntries) || __privateGet(this, _log)[0].at < oldest)) {
    __privateSet(this, _logBase, __privateGet(this, _log).shift().transaction.revision);
  }
};
function applyUpdates(values, updates) {
  const next = { ...values };
  for (const [name, value] of Object.entries(updates)) {
    if (value === void 0) delete next[name];
    else next[name] = value;
  }
  return next;
}
function safeExpand(manifest, dialect, queryId, values) {
  try {
    return expand(manifest, dialect, queryId, values);
  } catch (error) {
    return { error: error instanceof DataAppError ? error.code : String(error) };
  }
}
var _access;
var StateKeyHandle = class {
  /** @internal */
  constructor(name, declaration, access) {
    /** The key's name in the manifest's `state`. */
    __publicField(this, "name");
    /** The key's manifest declaration: `dataType`, `cardinality`, `domain`, `default` and the rest, as written. */
    __publicField(this, "declaration");
    __privateAdd(this, _access);
    this.name = name;
    this.declaration = declaration;
    __privateSet(this, _access, access);
  }
  /** Effective value: the explicit value, else the declared default. */
  get value() {
    return __privateGet(this, _access).value();
  }
  /** Whether the key has an explicit value; a key at its default is not set. */
  get isSet() {
    return __privateGet(this, _access).isSet();
  }
  /** Sets the key, like `app.state.set({ [name]: value })`; throws on an invalid value. Resolves to the new revision. */
  set(value, options = {}) {
    return __privateGet(this, _access).set(value, options);
  }
  /** Returns the key to its default ("no filter"). Resolves to the new revision. */
  unset(options = {}) {
    return __privateGet(this, _access).set(void 0, options);
  }
  /**
   * Calls back with the key's choices (`members`), its `value`, and the values that aren't among the
   * choices (`missing`), now and whenever the domain query's expansion or the key's value changes.
   * Throws `UNSUPPORTED` unless the key has a `members` or `fromQuery` domain. Returns an unsubscribe function.
   */
  subscribeDomain(callback, options = {}) {
    return __privateGet(this, _access).subscribeDomain(callback, options);
  }
};
_access = new WeakMap();
var _access2, _Gesture_instances, live_fn;
var Gesture = class {
  /** @internal */
  constructor(access) {
    __privateAdd(this, _Gesture_instances);
    __privateAdd(this, _access2);
    __privateSet(this, _access2, access);
  }
  /** False once the gesture is committed or cancelled, including by an agent write, undo, redo or restore. */
  get active() {
    return __privateGet(this, _access2).active();
  }
  /** Previews keys, validated like `app.state.set` (throws on a bad value); an `undefined` value unsets. */
  set(values) {
    __privateMethod(this, _Gesture_instances, live_fn).call(this);
    __privateGet(this, _access2).set(values);
  }
  /** Previews returning keys to their defaults. */
  unset(names) {
    this.set(Object.fromEntries([names].flat().map((n) => [n, void 0])));
  }
  /** Commits the preview as one write and one undo step. Resolves to the new revision, or undefined if nothing changed. */
  commit() {
    __privateMethod(this, _Gesture_instances, live_fn).call(this);
    return __privateGet(this, _access2).commit();
  }
  /** Drops the preview; state goes back to what it was before the gesture. */
  cancel() {
    __privateMethod(this, _Gesture_instances, live_fn).call(this);
    __privateGet(this, _access2).cancel();
  }
};
_access2 = new WeakMap();
_Gesture_instances = new WeakSet();
live_fn = function() {
  if (!__privateGet(this, _access2).active()) throw new DataAppError("UNSUPPORTED", "the gesture was already committed or cancelled");
};

// src/telemetry.ts
var _now2, _emit, _pending2, _inFlight, _lastReady;
var Telemetry = class {
  constructor(now, startedAt, initialRevision, emit) {
    __privateAdd(this, _now2);
    __privateAdd(this, _emit);
    __privateAdd(this, _pending2, /* @__PURE__ */ new Map());
    __privateAdd(this, _inFlight, /* @__PURE__ */ new Set());
    __privateAdd(this, _lastReady, -Infinity);
    __privateSet(this, _now2, now);
    __privateSet(this, _emit, emit);
    __privateGet(this, _pending2).set(initialRevision, { start: startedAt, trigger: "load" });
  }
  onCommit(revision, source) {
    __privateGet(this, _pending2).set(revision, { start: __privateGet(this, _now2).call(this), trigger: "change", source });
  }
  /** Returns undefined if ready() was already reported for `revision`. */
  ready(revision) {
    const entry = __privateGet(this, _pending2).get(revision);
    if (revision <= __privateGet(this, _lastReady) || !entry) return void 0;
    const at = __privateGet(this, _now2).call(this);
    const superseded = [...__privateGet(this, _pending2).keys()].filter((r) => r < revision);
    const first = superseded.length > 0 ? __privateGet(this, _pending2).get(superseded[0]) : void 0;
    const event = {
      type: "ready",
      revision,
      trigger: entry.trigger,
      ...entry.source && { source: entry.source },
      startedAt: entry.start,
      at,
      elapsedMs: at - entry.start,
      superseded,
      ...first && { elapsedSinceFirstMs: at - first.start },
      pendingRuns: [...__privateGet(this, _inFlight)].map((run) => ({ ...run }))
    };
    __privateGet(this, _pending2).clear();
    __privateSet(this, _lastReady, revision);
    __privateGet(this, _emit).call(this, event);
    return event;
  }
  span(name, startedAt, at) {
    __privateGet(this, _emit).call(this, { type: "span", name, startedAt, at, durationMs: at - startedAt });
  }
  /** `query(id).run()` calls aren't listed as pending at ready(): only views and subscriptions are. */
  beginRun(queryId, revision, trigger, caller) {
    const run = { queryId, revision, phase: "query" };
    if (caller.caller !== "query") __privateGet(this, _inFlight).add(run);
    const start = __privateGet(this, _now2).call(this);
    let renderStart;
    let served = "none";
    let requestId;
    let finished = false;
    return {
      served: (how, id) => {
        served = how;
        requestId = id;
      },
      rendering: () => {
        renderStart = __privateGet(this, _now2).call(this);
        run.phase = "render";
      },
      finish: (outcome, rows, error) => {
        if (finished) return;
        finished = true;
        __privateGet(this, _inFlight).delete(run);
        const at = __privateGet(this, _now2).call(this);
        __privateGet(this, _emit).call(this, {
          type: "run",
          queryId,
          revision,
          startedAt: start,
          at,
          trigger,
          caller: caller.caller,
          ...caller.view !== void 0 && { view: caller.view },
          ...caller.key !== void 0 && { key: caller.key },
          served,
          ...requestId !== void 0 && { requestId },
          queryMs: (renderStart ?? at) - start,
          ...renderStart !== void 0 && { renderMs: at - renderStart },
          outcome,
          ...rows !== void 0 && { rows },
          ...outcome === "error" && error !== void 0 && { error: error instanceof Error ? error.message : String(error) },
          afterReady: __privateGet(this, _lastReady) >= revision
        });
      }
    };
  }
};
_now2 = new WeakMap();
_emit = new WeakMap();
_pending2 = new WeakMap();
_inFlight = new WeakMap();
_lastReady = new WeakMap();

// src/app.ts
var DEFAULT_CACHE_SIZE = 0;
async function createDataApp(options) {
  const now = options.now ?? Date.now;
  const loadStart = now();
  const { dialect } = options.provider;
  const manifest = typeof options.manifest === "object" ? checkManifest(options.manifest, dialect, { debug: options.debug }) : await loadManifest(options.manifest, { fetch: options.fetch, dialect, debug: options.debug });
  const spans = [...options.spans ?? [], { name: "manifest", startedAt: loadStart, at: now() }];
  return new DataApp(manifest, options, options.startedAt ?? loadStart, spans);
}
var _host, _now3, _packageVersion, _engine5, _telemetry, _bridge, _disposers, _disposed2, _telemetryListeners, _inspecting, _inspectListeners, _DataApp_instances, applyInspecting_fn, emitTelemetry_fn, onCommit_fn;
var DataApp = class {
  /**
   * Prefer {@link createDataApp}, which loads and checks the manifest first.
   * @param startedAt When loading began, for the load `ready` event (default: now).
   * @param spans Loading steps already timed, reported as `span` events.
   * @internal
   */
  constructor(manifest, options, startedAt, spans = []) {
    __privateAdd(this, _DataApp_instances);
    /** The checked manifest. */
    __publicField(this, "manifest");
    /** The app's state: read and write keys, undo/redo, transactions and the change feed. */
    __publicField(this, "state");
    __privateAdd(this, _host);
    __privateAdd(this, _now3);
    __privateAdd(this, _packageVersion);
    __privateAdd(this, _engine5);
    __privateAdd(this, _telemetry);
    __privateAdd(this, _bridge);
    __privateAdd(this, _disposers, []);
    __privateAdd(this, _disposed2, false);
    __privateAdd(this, _telemetryListeners, /* @__PURE__ */ new Set());
    __privateAdd(this, _inspecting, false);
    __privateAdd(this, _inspectListeners, /* @__PURE__ */ new Set());
    this.manifest = manifest;
    __privateSet(this, _host, options.host);
    __privateSet(this, _now3, options.now ?? Date.now);
    const initial = __privateGet(this, _host)?.initialSnapshot;
    __privateSet(this, _packageVersion, __privateGet(this, _host)?.packageVersion ?? initial?.packageVersion ?? "unknown");
    const restoreStart = __privateGet(this, _now3).call(this);
    this.state = new StateStore(manifest, options.provider.dialect, { now: __privateGet(this, _now3), initial });
    if (initial) spans = [...spans, { name: "state.restore", startedAt: restoreStart, at: __privateGet(this, _now3).call(this) }];
    __privateSet(this, _telemetry, new Telemetry(__privateGet(this, _now3), startedAt ?? __privateGet(this, _now3).call(this), this.state.revision, (event) => __privateMethod(this, _DataApp_instances, emitTelemetry_fn).call(this, event)));
    __privateSet(this, _engine5, new QueryEngine({
      manifest,
      provider: options.provider,
      host: __privateGet(this, _host),
      state: this.state,
      telemetry: __privateGet(this, _telemetry),
      cacheSize: options.cacheSize ?? DEFAULT_CACHE_SIZE
    }));
    const domains = new Domains(manifest, __privateGet(this, _engine5), this.state);
    this.state.useDomains(domains);
    __privateGet(this, _disposers).push(() => domains.dispose());
    __privateGet(this, _disposers).push(this.state.onChange((event) => __privateMethod(this, _DataApp_instances, onCommit_fn).call(this, event)));
    __privateGet(this, _disposers).push(this.state.onPreview((changed, ended) => ended ? __privateGet(this, _engine5).endPreview(changed) : __privateGet(this, _engine5).onPreview(changed)));
    if (__privateGet(this, _host)) {
      const bridge = connectHost(this, __privateGet(this, _host), {
        now: __privateGet(this, _now3),
        applyInspecting: (on) => __privateMethod(this, _DataApp_instances, applyInspecting_fn).call(this, on),
        assertLive: () => __privateGet(this, _engine5).assertLive()
      });
      __privateSet(this, _bridge, bridge);
      __privateGet(this, _disposers).push(() => bridge.stop());
    }
    if (typeof document !== "undefined") {
      __privateGet(this, _disposers).push(installInspector(this, options.inspector ?? defaultInspector, {
        history: options.inspectorHistory,
        cache: () => __privateGet(this, _engine5).cacheSummary()
      }));
    }
    for (const span of spans) __privateGet(this, _telemetry).span(span.name, span.startedAt, span.at);
  }
  /** The view the manifest declares as `viewId`, to render. Throws `UNKNOWN_VIEW` if there is none. */
  view(viewId) {
    const view = this.manifest.views?.find((v) => v.id === viewId);
    if (!view) throw new DataAppError("UNKNOWN_VIEW", `the manifest declares no view ${viewId}`, { reason: viewId });
    return new ViewHandle(view, __privateGet(this, _engine5));
  }
  /** The named query `queryId`, to run, subscribe to or explain. Throws `UNKNOWN_QUERY` if there is none. */
  query(queryId) {
    return new QueryHandle(findQuery(this.manifest, queryId), __privateGet(this, _engine5));
  }
  /** The datasource the manifest declares as `datasourceId`. Throws `UNKNOWN_DATASOURCE` if there is none. */
  datasource(datasourceId) {
    const datasource = this.manifest.datasources?.find((d) => d.id === datasourceId);
    if (!datasource) throw new DataAppError("UNKNOWN_DATASOURCE", `the manifest declares no datasource "${datasourceId}"`);
    return new DatasourceHandle(datasource, __privateGet(this, _engine5));
  }
  /**
   * The app's declaration that the screen now reflects the current state. Call it after the first
   * render and after each re-render; returns undefined if this revision was already reported.
   */
  ready() {
    return __privateGet(this, _telemetry).ready(this.state.revision);
  }
  /** Local view of the telemetry sent to the host (ready and subscription-run timings). */
  onTelemetry(listener) {
    __privateGet(this, _telemetryListeners).add(listener);
    return () => __privateGet(this, _telemetryListeners).delete(listener);
  }
  /** Whether inspect mode is on. The host or Alt+Shift+I toggles it; the inspector draws it. */
  get inspecting() {
    return __privateGet(this, _inspecting);
  }
  /**
   * Turns inspect mode on or off from inside the app, notifies {@link onInspectChange} listeners and
   * tells the host. Inspectors call `InspectContext.exit()` instead. @internal
   */
  setInspecting(inspecting) {
    if (!__privateMethod(this, _DataApp_instances, applyInspecting_fn).call(this, inspecting)) return;
    try {
      __privateGet(this, _host)?.reportInspecting?.(inspecting);
    } catch (error) {
      console.error("[data-app] reportInspecting failed", error);
    }
  }
  /** Calls `listener` whenever inspect mode turns on or off; returns a function that removes it. */
  onInspectChange(listener) {
    __privateGet(this, _inspectListeners).add(listener);
    return () => __privateGet(this, _inspectListeners).delete(listener);
  }
  /** The persisted state and its revision, as the host saves it for custom views and restores. */
  getSnapshot() {
    return {
      manifestVersion: this.manifest.manifestVersion,
      packageVersion: __privateGet(this, _packageVersion),
      revision: this.state.revision,
      state: this.state.persistedValues()
    };
  }
  /**
   * Resolves once queued state writes have committed and every subscription and view run they
   * triggered, render included, has finished. Failed runs count as finished.
   */
  settled() {
    return __privateGet(this, _engine5).settled();
  }
  /**
   * Drops every cached result and datasource metadata and re-runs every subscription and view, for
   * when the data behind the queries may have changed. Resolves once those runs and renders have finished.
   */
  async refresh() {
    __privateGet(this, _engine5).assertLive();
    __privateGet(this, _engine5).invalidate();
    await __privateGet(this, _engine5).settled();
  }
  /**
   * Calls {@link ready} once the first runs and renders settle, and again after every state change
   * settles. For apps whose screen is current whenever their callbacks have finished. Returns a
   * function that stops it.
   */
  reportReadyWhenSettled() {
    let active = true;
    const report = async () => {
      await this.settled();
      if (active && !__privateGet(this, _disposed2)) this.ready();
    };
    void report();
    const stop = this.state.onChange(() => void report());
    return () => {
      active = false;
      stop();
    };
  }
  /**
   * Stops every subscription and view, cancels requests in flight, and detaches from the host and
   * the page. Later runs, subscriptions, renders, metadata calls and `refresh` throw `APP_DISPOSED`.
   */
  dispose() {
    if (__privateGet(this, _disposed2)) return;
    __privateSet(this, _disposed2, true);
    __privateGet(this, _engine5).dispose();
    for (const dispose of __privateGet(this, _disposers).splice(0)) dispose();
    __privateGet(this, _telemetryListeners).clear();
    __privateGet(this, _inspectListeners).clear();
  }
};
_host = new WeakMap();
_now3 = new WeakMap();
_packageVersion = new WeakMap();
_engine5 = new WeakMap();
_telemetry = new WeakMap();
_bridge = new WeakMap();
_disposers = new WeakMap();
_disposed2 = new WeakMap();
_telemetryListeners = new WeakMap();
_inspecting = new WeakMap();
_inspectListeners = new WeakMap();
_DataApp_instances = new WeakSet();
applyInspecting_fn = function(inspecting) {
  if (inspecting === __privateGet(this, _inspecting)) return false;
  __privateSet(this, _inspecting, inspecting);
  for (const listener of __privateGet(this, _inspectListeners)) {
    try {
      listener(inspecting);
    } catch (error) {
      console.error("[data-app] inspect listener failed", error);
    }
  }
  return true;
};
emitTelemetry_fn = function(event) {
  __privateGet(this, _host)?.reportTelemetry?.(event);
  for (const listener of __privateGet(this, _telemetryListeners)) {
    try {
      listener(event);
    } catch (error) {
      console.error("[data-app] telemetry listener failed", error);
    }
  }
};
onCommit_fn = function(event) {
  __privateGet(this, _telemetry).onCommit(event.revision, event.source);
  __privateGet(this, _engine5).onCommit(Object.keys(event.net));
  __privateGet(this, _bridge)?.notify(event.source);
};
export {
  DataAppError,
  MANIFEST_VERSION,
  VIEW_ATTRIBUTE,
  behaviorOf,
  boundsOf,
  checkManifest,
  checkStateValue,
  createDataApp,
  expand,
  explain,
  invalidState,
  invalidTemplate,
  loadManifest,
  netBetween,
  netChange,
  referencedKeys,
  resolveText
};
