/**
 * Strict JSON reader for untrusted text (model output, imported evidence).
 *
 * `JSON.parse` silently keeps the last duplicate key, so a payload such as
 * {"changes": {...valid}, "changes": {...hostile}} would be read differently
 * by different consumers. This parser mirrors what QFabric's Python gate
 * (`json.loads` + object_pairs_hook + parse_constant) accepts and rejects:
 *  - duplicate keys            → "duplicate JSON key: <key>"
 *  - NaN / Infinity / -Infinity → "non-finite JSON constant: <literal>"
 *  - anything else malformed   → "<label> must be UTF-8 JSON"
 *
 * Python distinguishes `1` (int) from `1.0` (float). Objects returned here
 * carry a hidden symbol listing keys whose value was written with a fraction
 * or exponent, so callers can reproduce Python's `isinstance(x, int)` checks.
 */

export const FLOAT_LITERAL_KEYS: unique symbol = Symbol("floatLiteralKeys");

export class JsonContractError extends Error {
  constructor(message: string, readonly errorType: "ValueError" | "TypeError" = "ValueError") {
    super(message);
    this.name = errorType;
  }
}

const MAX_DEPTH = 512;
const WS = new Set([" ", "\t", "\n", "\r"]);

export function parseStrictJson(text: string, label: string): unknown {
  const malformed = () => new JsonContractError(`${label} must be UTF-8 JSON`);
  let i = 0;

  const skip = () => {
    while (i < text.length && WS.has(text[i])) i++;
  };

  const parseString = (): string => {
    // Caller guarantees text[i] === '"'.
    i++;
    let out = "";
    while (true) {
      if (i >= text.length) throw malformed();
      const ch = text[i];
      if (ch === '"') {
        i++;
        return out;
      }
      if (ch === "\\") {
        const esc = text[i + 1];
        const simple: Record<string, string> = {
          '"': '"', "\\": "\\", "/": "/", b: "\b", f: "\f", n: "\n", r: "\r", t: "\t",
        };
        if (esc !== undefined && Object.hasOwn(simple, esc)) {
          out += simple[esc];
          i += 2;
        } else if (esc === "u") {
          const hex = text.slice(i + 2, i + 6);
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) throw malformed();
          out += String.fromCharCode(parseInt(hex, 16));
          i += 6;
        } else {
          throw malformed();
        }
        continue;
      }
      if (ch.charCodeAt(0) < 0x20) throw malformed();
      out += ch;
      i++;
    }
  };

  const parseNumber = (): { value: number; float: boolean } => {
    const pattern = /-?(0|[1-9][0-9]*)(\.[0-9]+)?([eE][+-]?[0-9]+)?/y;
    pattern.lastIndex = i;
    const m = pattern.exec(text);
    if (!m) throw malformed();
    i += m[0].length;
    return { value: Number(m[0]), float: m[2] !== undefined || m[3] !== undefined };
  };

  const parseValue = (depth: number): { value: unknown; float: boolean } => {
    if (depth > MAX_DEPTH) throw malformed();
    skip();
    const ch = text[i];
    if (ch === "{") {
      i++;
      const obj: Record<string, unknown> & { [FLOAT_LITERAL_KEYS]?: Set<string> } = {};
      const floats = new Set<string>();
      // Python's object_pairs_hook sees duplicates only once the object closes.
      let duplicate: string | null = null;
      skip();
      if (text[i] === "}") {
        i++;
      } else {
        while (true) {
          skip();
          if (text[i] !== '"') throw malformed();
          const key = parseString();
          skip();
          if (text[i] !== ":") throw malformed();
          i++;
          const item = parseValue(depth + 1);
          if (Object.hasOwn(obj, key) && duplicate === null) duplicate = key;
          Object.defineProperty(obj, key, {
            value: item.value, enumerable: true, writable: true, configurable: true,
          });
          if (item.float) floats.add(key);
          skip();
          if (text[i] === ",") {
            i++;
            continue;
          }
          if (text[i] === "}") {
            i++;
            break;
          }
          throw malformed();
        }
      }
      if (duplicate !== null) throw new JsonContractError(`duplicate JSON key: ${duplicate}`);
      Object.defineProperty(obj, FLOAT_LITERAL_KEYS, { value: floats, enumerable: false });
      return { value: obj, float: false };
    }
    if (ch === "[") {
      i++;
      const arr: unknown[] = [];
      skip();
      if (text[i] === "]") {
        i++;
        return { value: arr, float: false };
      }
      while (true) {
        arr.push(parseValue(depth + 1).value);
        skip();
        if (text[i] === ",") {
          i++;
          continue;
        }
        if (text[i] === "]") {
          i++;
          return { value: arr, float: false };
        }
        throw malformed();
      }
    }
    if (ch === '"') return { value: parseString(), float: false };
    for (const [literal, value] of [["true", true], ["false", false], ["null", null]] as const) {
      if (text.startsWith(literal, i)) {
        i += literal.length;
        return { value, float: false };
      }
    }
    for (const literal of ["NaN", "Infinity", "-Infinity"]) {
      if (text.startsWith(literal, i)) {
        throw new JsonContractError(`non-finite JSON constant: ${literal}`);
      }
    }
    if (ch === "-" || (ch >= "0" && ch <= "9")) return parseNumber();
    throw malformed();
  };

  const result = parseValue(0).value;
  skip();
  if (i !== text.length) throw malformed();
  return result;
}

/** True when the parsed object's `key` was written as e.g. `1.0` or `1e0`. */
export function isFloatLiteral(obj: object, key: string): boolean {
  const floats = (obj as { [FLOAT_LITERAL_KEYS]?: Set<string> })[FLOAT_LITERAL_KEYS];
  return floats?.has(key) ?? false;
}

/** Decode bytes as strict UTF-8, as Python's bytes.decode("utf-8") would. */
export function decodeUtf8(raw: Uint8Array, label: string): string {
  try {
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(raw);
  } catch {
    throw new JsonContractError(`${label} must be UTF-8 JSON`);
  }
}

export function encodeUtf8(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}
