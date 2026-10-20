/** Creates the bucket + CORS rule on a local S3-compatible server for the S3-driver e2e run. */
import { CreateBucketCommand, PutBucketCorsCommand, S3Client } from "@aws-sdk/client-s3";

const s3 = new S3Client({
  region: "us-east-1",
  endpoint: process.env.S3_ENDPOINT,
  forcePathStyle: true,
  credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID!, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY! },
});
(async () => {
  await s3.send(new CreateBucketCommand({ Bucket: process.env.S3_BUCKET! })).catch(() => undefined);
  await s3.send(
    new PutBucketCorsCommand({
      Bucket: process.env.S3_BUCKET!,
      CORSConfiguration: { CORSRules: [{ AllowedOrigins: ["*"], AllowedMethods: ["GET", "PUT", "HEAD"], AllowedHeaders: ["*"], ExposeHeaders: ["ETag", "Content-Length", "Content-Range"] }] },
    }),
  );
  console.log("bucket ready");
})();
