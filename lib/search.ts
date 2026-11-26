// 搜索容错：忽略大小写、宽窄字符、空格与常见分隔符，并允许单个字符的缺漏/错写
export function normalizeSearch(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "");
}

// 只判断编辑距离是否 ≤ 1，不构建完整矩阵
function withinOneEdit(a: string, b: string): boolean {
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if (long.length - short.length > 1) return false;

  let i = 0;
  let j = 0;
  let edited = false;
  while (i < short.length && j < long.length) {
    if (short[i] === long[j]) {
      i += 1;
      j += 1;
      continue;
    }
    if (edited) return false;
    edited = true;
    if (short.length === long.length) i += 1;
    j += 1;
  }
  return true;
}

export function fuzzyIncludes(text: string, query: string): boolean {
  if (!query) return true;
  if (text.includes(query)) return true;
  // 太短的词做容错只会放大噪音
  if (query.length < 3) return false;

  const maxLen = query.length + 1;
  for (let start = 0; start < text.length; start++) {
    for (let len = query.length - 1; len <= maxLen; len++) {
      const end = start + len;
      if (len < 1 || end > text.length) continue;
      if (withinOneEdit(text.slice(start, end), query)) return true;
    }
  }
  return false;
}

export function searchParts(query: string): string[] {
  return query
    .trim()
    .split(/[\s\-_./·、,，]+/)
    .map(normalizeSearch)
    .filter(Boolean);
}

// 每个查询片段都要命中至少一个字段（整串或分词后的词），多词之间是 AND
export function matchesSearch(query: string, fields: string[], fuzzy = true): boolean {
  const parts = searchParts(query);
  if (parts.length === 0) return true;

  const tokens = new Set<string>();
  for (const field of fields) {
    if (!field) continue;
    const joined = normalizeSearch(field);
    if (joined) tokens.add(joined);
    for (const piece of field.split(/[^a-zA-Z0-9\u4e00-\u9fff]+/)) {
      const token = normalizeSearch(piece);
      if (token) tokens.add(token);
    }
  }

  const list = [...tokens];
  const hit = (token: string, part: string) =>
    fuzzy ? fuzzyIncludes(token, part) : token.includes(part);

  if (parts.every((part) => list.some((token) => hit(token, part)))) return true;
  // 分词后逐段容错会漏掉跨词的错写（如 "qwen 3.9 flash"），再拼回整串试一次
  if (parts.length > 1) {
    const joined = parts.join("");
    return list.some((token) => hit(token, joined));
  }
  return false;
}