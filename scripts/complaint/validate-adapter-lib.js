const fs = require('node:fs');
const path = require('node:path');

const SCHEMA_PATH = path.join(__dirname, '..', '..', 'references', 'dpa-adapters', '_schema.json');
let cachedSchema;

function loadSchema() {
  if (!cachedSchema) cachedSchema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
  return cachedSchema;
}

function typeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (typeof v === 'number' && Number.isInteger(v)) return 'integer';
  return typeof v;
}

function validateAgainst(schema, value, pathStr, errors) {
  if (schema.type && typeOf(value) !== schema.type) {
    errors.push({ path: pathStr || '/', message: `expected ${schema.type}, got ${typeOf(value)}` });
    return;
  }
  if (schema.type === 'object') {
    const props = schema.properties || {};
    const required = schema.required || [];
    for (const key of required) {
      if (!(key in (value || {}))) errors.push({ path: `${pathStr}/${key}`, message: 'required' });
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value || {})) {
        if (!(key in props)) errors.push({ path: `${pathStr}/${key}`, message: 'unknown property' });
      }
    }
    for (const [key, childSchema] of Object.entries(props)) {
      if (key in (value || {})) validateAgainst(childSchema, value[key], `${pathStr}/${key}`, errors);
    }
  } else if (schema.type === 'array') {
    if (schema.minItems != null && value.length < schema.minItems) {
      errors.push({ path: pathStr, message: `minItems ${schema.minItems}` });
    }
    if (schema.items) {
      value.forEach((item, i) => validateAgainst(schema.items, item, `${pathStr}/${i}`, errors));
    }
  } else if (schema.type === 'string') {
    if (schema.minLength != null && value.length < schema.minLength) {
      errors.push({ path: pathStr, message: `minLength ${schema.minLength}` });
    }
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
      errors.push({ path: pathStr, message: `does not match pattern ${schema.pattern}` });
    }
    if (schema.enum && !schema.enum.includes(value)) {
      errors.push({ path: pathStr, message: `not one of ${schema.enum.join(',')}` });
    }
  } else if (schema.type === 'integer') {
    if (!Number.isInteger(value)) errors.push({ path: pathStr, message: 'not an integer' });
    else if (schema.minimum != null && value < schema.minimum) errors.push({ path: pathStr, message: `minimum ${schema.minimum}` });
  } else if (schema.type === 'boolean') {
    // type check above is sufficient
  }
}

function validateAdapter(adapter) {
  const schema = loadSchema();
  const errors = [];
  validateAgainst(schema, adapter, '', errors);
  return { ok: errors.length === 0, errors };
}

module.exports = { validateAdapter };
