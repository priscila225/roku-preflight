export type TextFile = {
  path: string;
  content: string;
};

export type SourceHit = {
  file: string;
  line: number;
  excerpt: string;
};

const SOURCE_EXT = new Set([".brs", ".bs", ".xml"]);

const VENDOR_DIRS = new Set([
  "vendor",
  "vendors",
  "libs",
  "lib",
  "third_party",
  "third-party",
  "thirdparty",
  "sdk",
  "sdks",
  "external",
  "externals",
  "3rdparty",
  "3rd-party",
  "3rd_party",
]);

const VENDOR_NAME_RE = /sdk|vendor|third_party|third-party|thirdparty/i;

function baseName(segment: string): string {
  return segment.replace(/\.(brs|bs|xml)$/i, "");
}

/** A path segment that looks like a vendor SDK folder or component (e.g. ExampleAnalyticsSdk, foo-sdk). */
function looksLikeSdkName(segment: string): boolean {
  const base = baseName(segment);
  return /(^|[._-])sdk([._-]|$)/i.test(base) || /sdk$/i.test(base);
}

function pathParts(path: string): string[] {
  return path.replace(/\\/g, "/").split("/").filter(Boolean);
}

/** True when a path looks vendored: known vendor folders, or any folder or file name
 * containing sdk, vendor, thirdparty or third_party, at any depth. */
export function isVendoredPath(path: string): boolean {
  const parts = pathParts(path);
  if (!parts.length) return false;
  for (const part of parts) {
    const base = baseName(part);
    if (VENDOR_DIRS.has(base.toLowerCase())) return true;
    if (VENDOR_NAME_RE.test(base)) return true;
    if (looksLikeSdkName(base)) return true;
  }
  return false;
}

/** A conservative third-party license or copyright header, not a generic app copyright. */
export function hasThirdPartyHeader(content: string): boolean {
  const header = content.split(/\r?\n/).slice(0, 40).join("\n");
  if (/\bthird[ _-]?party\b/i.test(header)) return true;
  if (/\bvendored\b|\bvendor\s+sdk\b/i.test(header)) return true;
  if (/\boriginally\s+(written|published|released|from)\b/i.test(header)) return true;
  return false;
}

/** Dense or very long-line BrightScript, typical of a minified or bundled vendor file. */
export function isMinifiedBrs(path: string, content: string): boolean {
  if (!/\.(brs|bs)$/i.test(path) || !content) return false;
  const lines = content.split(/\r?\n/);
  if (lines.some((l) => l.length >= 400)) return true;
  const nonempty = lines.filter((l) => l.trim());
  if (nonempty.length >= 3 && nonempty.filter((l) => l.length >= 200).length / nonempty.length >= 0.8) {
    return true;
  }
  return false;
}

/** Path, third-party header, or minified BrightScript. */
export function isVendoredFile(path: string, content?: string): boolean {
  if (isVendoredPath(path)) return true;
  if (content === undefined) return false;
  return hasThirdPartyHeader(content) || isMinifiedBrs(path, content);
}

export function isSourcePath(path: string): boolean {
  const lower = path.toLowerCase();
  const dot = lower.lastIndexOf(".");
  if (dot < 0) return false;
  return SOURCE_EXT.has(lower.slice(dot));
}

/** Drop full-line and trailing BrightScript comments, keeping original line breaks. */
export function stripBrsComments(content: string): string {
  return content.split(/\r?\n/).map(stripBrsLine).join("\n");
}

function stripBrsLine(line: string): string {
  const trimmed = line.trim();
  if (!trimmed) return line;
  if (trimmed.startsWith("'")) return "";
  if (/^rem(\s|$)/i.test(trimmed)) return "";
  let inString = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inString) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          i++;
          continue;
        }
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "'") return line.slice(0, i);
  }
  return line;
}

export function stripXmlComments(content: string): string {
  return content.replace(/<!--[\s\S]*?-->/g, (block) => block.replace(/[^\n]/g, " "));
}

export function searchable(file: TextFile): string {
  const lower = file.path.toLowerCase();
  if (lower.endsWith(".xml")) return stripXmlComments(file.content);
  return stripBrsComments(file.content);
}

export function searchSources(sources: TextFile[], pattern: RegExp): SourceHit[] {
  const hits: SourceHit[] = [];
  for (const file of sources) {
    const text = searchable(file);
    const lines = text.split(/\n/);
    lines.forEach((line, i) => {
      pattern.lastIndex = 0;
      if (pattern.test(line)) {
        hits.push({ file: file.path, line: i + 1, excerpt: line.trim().slice(0, 160) });
      }
    });
  }
  return hits;
}

export function hasMatch(sources: TextFile[], pattern: RegExp): boolean {
  return searchSources(sources, pattern).length > 0;
}

const MAIN_RE = /(?:sub|function)\s+(main|runuserinterface)\s*\(\s*([A-Za-z_]\w*)/i;

export type MainEntry = { file: string; line: number; name: string; arg: string };

export function findMainEntries(sources: TextFile[]): MainEntry[] {
  const found: MainEntry[] = [];
  for (const file of sources) {
    const text = stripBrsComments(file.content);
    const lines = text.split(/\n/);
    lines.forEach((line, i) => {
      const m = line.match(MAIN_RE);
      if (m) found.push({ file: file.path, line: i + 1, name: m[1]!, arg: m[2]! });
    });
  }
  return found;
}

/** A Main/RunUserInterface with no arguments at all. */
export function findMainWithoutArgs(sources: TextFile[]): SourceHit[] {
  const re = /(?:sub|function)\s+(main|runuserinterface)\s*\(\s*\)/i;
  return searchSources(sources, re);
}

export function at(hit: SourceHit): string {
  return `${hit.file}:${hit.line}`;
}
