/**
 * Configures CORS on the S3-compatible bucket so browsers can upload/stream directly
 * (presigned URLs). Runs during deployment; safe to run repeatedly. Never fails the build.
 */
import { PutBucketCorsCommand, S3Client } from "@aws-sdk/client-s3";

async function main() {
  if (process.env.STORAGE_DRIVER !== "s3") return console.log("[storage] local driver – nothing to configure");
  const origins = [process.env.APP_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`]
    .filter(Boolean)
    .map((o) => o!.replace(/\/$/, ""));
  if (origins.length === 0) return console.warn("[storage] APP_URL not set – skipping CORS setup");
  const s3 = new S3Client({
    region: process.env.S3_REGION || "auto",
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "", secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "" },
  });
  await s3.send(
    new PutBucketCorsCommand({
      Bucket: process.env.S3_BUCKET!,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: [...new Set(origins)],
            AllowedMethods: ["GET", "PUT", "HEAD"],
            AllowedHeaders: ["*"],
            ExposeHeaders: ["ETag", "Content-Length", "Content-Range", "Accept-Ranges"],
            MaxAgeSeconds: 3600,
          },
        ],
      },
    }),
  );
  console.log(`[storage] CORS configured for ${origins.join(", ")}`);
}

main().catch((e) => console.warn("[storage] could not configure CORS automatically:", e?.message ?? e));
