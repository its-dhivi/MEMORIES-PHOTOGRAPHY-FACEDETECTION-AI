import Joi from 'joi';

export const validateEnvironment = (values: Record<string, unknown>) => {
  const schema = Joi.object({
    NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
    PORT: Joi.number().port().default(4000),
    SWAGGER_ENABLED: Joi.boolean().default(false),
    DATABASE_URL: Joi.string()
      .uri({ scheme: ['postgresql'] })
      .required(),
    WEB_ORIGIN: Joi.string().uri().required(),
    REDIS_URL: Joi.string()
      .uri({ scheme: ['redis', 'rediss'] })
      .required(),
    S3_ENDPOINT: Joi.string().uri().optional(),
    S3_PUBLIC_ENDPOINT: Joi.string().uri().required(),
    S3_REGION: Joi.string().required(),
    S3_ACCESS_KEY: Joi.string().required(),
    S3_SECRET_KEY: Joi.string().min(8).required(),
    S3_BUCKET_ORIGINALS: Joi.string().required(),
    S3_BUCKET_DERIVATIVES: Joi.string().required(),
    PUBLIC_APP_URL: Joi.string().uri().required(),
    MAX_PHOTO_BYTES: Joi.number().integer().min(1048576).default(524288000),
    MAX_ORIGINAL_PHOTO_BYTES: Joi.number().integer().min(1048576).default(524288000),
    MULTIPART_UPLOAD_THRESHOLD_BYTES: Joi.number().integer().min(5242880).default(33554432),
    MULTIPART_PART_SIZE_BYTES: Joi.number().integer().min(5242880).default(16777216),
    MULTIPART_MAX_PARTS_PER_REQUEST: Joi.number().integer().min(1).max(1000).default(100),
    STUDIO_STORAGE_QUOTA_BYTES: Joi.number().integer().min(1048576).default(536870912000),
    PRESIGNED_URL_TTL_SECONDS: Joi.number().integer().min(60).max(3600).default(900),
    UPLOAD_SESSION_TTL_SECONDS: Joi.number().integer().min(300).max(86400).default(3600),
    AI_SERVICE_URL: Joi.string().uri().required(),
    AI_INTERNAL_TOKEN: Joi.string().min(32).required(),
    FACE_INFERENCE_TIMEOUT_SECONDS: Joi.number().integer().min(5).max(300).default(60),
    FACE_PROCESSING_MAX_RETRIES: Joi.number().integer().min(1).max(10).default(5),
    FACE_MAX_CONCURRENT_INFERENCES: Joi.number().integer().min(1).max(32).default(2),
    FACE_MATCH_MAX_RESULTS: Joi.number().integer().min(1).max(500).default(100),
    GUEST_ZIP_MAX_PHOTOS: Joi.number().integer().min(1).max(500).default(100),
    GUEST_ZIP_MAX_BYTES: Joi.number().integer().min(1048576).default(2147483648),
    GUEST_ZIP_MAX_OUTPUT_BYTES: Joi.number().integer().min(1048576).default(11811160064),
    GUEST_ZIP_JOB_TIMEOUT_SECONDS: Joi.number().integer().min(60).default(3600),
    JWT_ACCESS_SECRET: Joi.string().min(32).required(),
    JWT_REFRESH_SECRET: Joi.string().min(32).required(),
    COOKIE_SECRET: Joi.string().min(32).required(),
    PASSWORD_RESET_PEPPER: Joi.string().min(32).required(),
    ACCESS_TOKEN_TTL_SECONDS: Joi.number().integer().min(300).max(3600).default(900),
    REFRESH_TOKEN_TTL_SECONDS: Joi.number().integer().min(3600).default(2592000),
  }).unknown(true);
  const result = schema.validate(values, { abortEarly: false }) as {
    error?: Joi.ValidationError;
    value: unknown;
  };
  if (result.error) throw new Error(`Environment validation failed: ${result.error.message}`);
  return result.value as Record<string, unknown>;
};
