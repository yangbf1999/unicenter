import { NextResponse } from "next/server"

import { resolveLicensePrivateKey, rsaDecryptBase64 } from "@/lib/rsa/decrypt"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * POST /api/v1/rsa/decrypt
 * body: { ciphertext: "<RSA PKCS1 Base64>" }
 * → { plaintext: "<原始字符串>" }
 */
export async function POST(req: Request) {
  try {
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const ciphertext =
      typeof body === "object" &&
      body !== null &&
      typeof (body as { ciphertext?: unknown }).ciphertext === "string"
        ? (body as { ciphertext: string }).ciphertext.trim()
        : ""

    if (!ciphertext) {
      return NextResponse.json(
        { error: "ciphertext (base64 string) is required" },
        { status: 400 },
      )
    }

    const privateKey = resolveLicensePrivateKey()
    const plaintext = rsaDecryptBase64(ciphertext, privateKey)
    return NextResponse.json({ plaintext })
  } catch (e: any) {
    const message = e?.message || String(e)
    const status = message.includes("LICENSE_RSA_PRIVATE_KEY") ? 503 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
