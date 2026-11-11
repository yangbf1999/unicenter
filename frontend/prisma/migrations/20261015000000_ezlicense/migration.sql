-- RSA-encrypted serial numbers (ciphertext in data)
CREATE TABLE IF NOT EXISTS "ezlicense" (
    "id" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    CONSTRAINT "ezlicense_pkey" PRIMARY KEY ("id")
);
