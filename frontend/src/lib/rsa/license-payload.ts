/**
 * 解析并校验 license 明文（兼容单引号伪 JSON）。
 * 必须包含 expireDate / edition / features。
 */
export type LicensePayload = {
  expireDate: unknown
  edition: unknown
  features: unknown
  [key: string]: unknown
}

function tryParseObject(text: string): Record<string, unknown> | null {
  const trimmed = text.trim()
  if (!trimmed) return null

  const attempts = [
    trimmed,
    trimmed
      .replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:/g, '$1"$2":')
      .replace(/'/g, '"'),
  ]

  for (const candidate of attempts) {
    try {
      const parsed = JSON.parse(candidate)
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>
      }
    } catch {
      // try next
    }
  }
  return null
}

function hasValue(v: unknown): boolean {
  if (v === undefined || v === null) return false
  if (typeof v === "string" && v.trim() === "") return false
  return true
}

/** 成功返回对象；缺字段或无法解析返回 null（调用方报「无效的序列号」） */
export function parseAndValidateLicensePayload(plaintext: string): LicensePayload | null {
  const obj = tryParseObject(plaintext)
  if (!obj) return null
  if (!hasValue(obj.expireDate) || !hasValue(obj.edition) || !hasValue(obj.features)) {
    return null
  }
  return obj as LicensePayload
}
