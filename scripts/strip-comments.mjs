#!/usr/bin/env node
/**
 * Strips comments from JavaScript files in place, for production deployment.
 *
 * Usage: node scripts/strip-comments.mjs <dir>
 *
 * Recursively processes every *.js file under <dir> (skipping *.min.js). Only comments are
 * removed: code is copied verbatim, identifiers are never renamed, and each removed comment is
 * replaced by the line breaks it contained, so line numbers in production stack traces match
 * the source exactly. License comments (block comments starting with "!" or containing
 * @license, @preserve or @copyright) are kept.
 *
 * Each result is verified before it is written: the output must parse, and must produce the
 * same tokens on the same lines as the original. Any failure exits with code 1 so the deploy
 * stops instead of shipping broken code.
 */

import fs from 'fs';
import path from 'path';
// eslint-disable-next-line import/no-extraneous-dependencies -- build-time only
import { parse, tokenizer } from 'acorn';

const PRESERVE_PATTERN = /@(license|preserve|copyright)\b/;
const LINE_BREAKS = /[\r\n\u2028\u2029]/;
const NON_LINE_BREAKS = /[^\r\n\u2028\u2029]/g;

const isPreserved = (comment) => comment.type === 'Block'
  && (comment.value.startsWith('!') || PRESERVE_PATTERN.test(comment.value));

/**
 * @param {string} source
 * @param {string} sourceType 'module' or 'script'
 * @returns {{options: object, comments: Array<object>}}
 */
function parseAs(source, sourceType) {
  const options = { ecmaVersion: 'latest', sourceType, locations: true };
  const comments = [];
  parse(source, { ...options, onComment: comments });
  return { options, comments };
}

/**
 * Parses as an ES module, falling back to a classic script (e.g. src/slip.js).
 * @param {string} source
 * @returns {{options: object, comments: Array<object>}}
 */
function parseSource(source) {
  try {
    return parseAs(source, 'module');
  } catch (moduleError) {
    try {
      return parseAs(source, 'script');
    } catch {
      throw moduleError;
    }
  }
}

/**
 * @param {string} source
 * @param {Array<object>} comments
 * @returns {string}
 */
function removeComments(source, comments) {
  let output = '';
  let last = 0;
  comments.filter((comment) => !isPreserved(comment)).forEach((comment) => {
    output += source.slice(last, comment.start).replace(/[ \t]+$/, '');
    const text = source.slice(comment.start, comment.end);
    if (LINE_BREAKS.test(text)) {
      output += text.replace(NON_LINE_BREAKS, '');
    } else if (comment.type === 'Block') {
      // Keep tokens separated, e.g. `return /* x */ y` must not become `returny`
      const prev = output.at(-1);
      const next = source[comment.end];
      const atLineEdge = prev === undefined || LINE_BREAKS.test(prev)
        || next === undefined || /\s/.test(next);
      output += atLineEdge ? '' : ' ';
    }
    last = comment.end;
  });
  return output + source.slice(last);
}

/**
 * @param {string} source
 * @param {object} options
 * @returns {Array<string>}
 */
function tokenSignature(source, options) {
  return Array.from(tokenizer(source, options), (token) => (
    `${token.loc.start.line}:${token.type.label}:${source.slice(token.start, token.end)}`
  ));
}

/**
 * Throws if the stripped output differs from the original in anything but comments.
 * @param {string} original
 * @param {string} stripped
 * @param {object} options
 */
function verify(original, stripped, options) {
  parse(stripped, options);
  const before = tokenSignature(original, options);
  const after = tokenSignature(stripped, options);
  const index = before.findIndex((token, i) => token !== after[i]);
  if (index !== -1 || before.length !== after.length) {
    const at = index === -1 ? Math.min(before.length, after.length) : index;
    throw new Error(`token mismatch: expected "${before[at]}", got "${after[at]}"`);
  }
}

function main() {
  const root = process.argv[2];
  if (!root) {
    console.error('Usage: node scripts/strip-comments.mjs <dir>');
    process.exit(1);
  }

  const files = fs.readdirSync(root, { recursive: true })
    .filter((file) => file.endsWith('.js') && !file.endsWith('.min.js'))
    .map((file) => path.join(root, file))
    .sort();

  let totalBefore = 0;
  let totalAfter = 0;
  let failed = false;
  files.forEach((file) => {
    const source = fs.readFileSync(file, 'utf8');
    try {
      const { options, comments } = parseSource(source);
      const stripped = removeComments(source, comments);
      verify(source, stripped, options);
      fs.writeFileSync(file, stripped);
      const before = Buffer.byteLength(source);
      const after = Buffer.byteLength(stripped);
      totalBefore += before;
      totalAfter += after;
      console.log(`${file}: ${before} -> ${after} bytes`);
    } catch (error) {
      failed = true;
      console.error(`✗ ${file}: ${error.message}`);
    }
  });

  console.log(`Total: ${totalBefore} -> ${totalAfter} bytes (${totalBefore - totalAfter} saved)`);
  if (failed) {
    process.exit(1);
  }
}

main();
