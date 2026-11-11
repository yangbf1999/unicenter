import crypto from "node:crypto"

/**
 * RSA 解密（对齐 Java RSA/ECB/PKCS1Padding）。
 * 密文为公钥加密后的 Base64；支持分块密文拼接。
 */
export function rsaDecryptBase64(ciphertextBase64: string, privateKeyPem: string): string {
  const pem = privateKeyPem.trim()
  if (!pem.includes("PRIVATE KEY")) {
    throw new Error("LICENSE_RSA_PRIVATE_KEY must be a PEM private key")
  }

  const buf = Buffer.from(ciphertextBase64.trim(), "base64")
  if (buf.length === 0) {
    throw new Error("ciphertext is empty or not valid base64")
  }

  const keyBits =
    crypto.createPrivateKey(pem).asymmetricKeyDetails?.modulusLength ?? 2048
  const block = keyBits / 8
  if (buf.length % block !== 0) {
    throw new Error(
      `ciphertext length ${buf.length} is not a multiple of RSA block size ${block}`,
    )
  }

  const parts: Buffer[] = []
  for (let i = 0; i < buf.length; i += block) {
    const slice = buf.subarray(i, i + block)
    parts.push(
      crypto.privateDecrypt(
        { key: pem, padding: crypto.constants.RSA_PKCS1_PADDING },
        slice,
      ),
    )
  }
  return Buffer.concat(parts).toString("utf8")
}

export function resolveLicensePrivateKey(): string {
  const fromEnv = process.env.LICENSE_RSA_PRIVATE_KEY?.trim()
  if (fromEnv) {
    // 允许 .env 里用 \n 转义的单行 PEM
    return fromEnv.replace(/\\n/g, "\n")
  }
  throw new Error(
    "LICENSE_RSA_PRIVATE_KEY is not set. Put the PEM private key in frontend/.env",
  )
}
