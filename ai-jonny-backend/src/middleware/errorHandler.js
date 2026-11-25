import { config } from '../config/index.js';

export function errorHandler(err, req, res, next) {
  const isUploadValidationError =
    err.name === 'MulterError' ||
    err.code === 'LIMIT_FILE_SIZE' ||
    err.code === 'INVALID_FILE_TYPE' ||
    err.code === 'INVALID_FILE_EXTENSION' ||
    err.code === 'INVALID_MIME_TYPE' ||
    (typeof err.message === 'string' && (
      err.message.includes('forbidden for security') ||
      err.message.includes('Unsupported file extension') ||
      err.message.includes('Invalid or untrusted MIME type')
    ));

  const statusCode = isUploadValidationError ? 400 : (err.status || err.statusCode || 500);
  const message = err.message || 'An unexpected internal error occurred';

  if (statusCode >= 500) {
    console.error('[Error]', err);
  }

  res.status(statusCode).json({
    success: false,
    error: message,
    code: err.code || (isUploadValidationError ? 'INVALID_FILE_UPLOAD' : 'SERVER_ERROR'),
    ...(config.env === 'development' && statusCode >= 500 && { stack: err.stack })
  });
}

