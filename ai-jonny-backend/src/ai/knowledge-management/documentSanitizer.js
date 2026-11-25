/**
 * Kiaan AI Document Sanitizer (Step 9)
 * Validates, cleans, and protects knowledge base documents against prompt injection,
 * malicious system overrides, and credential leaks.
 */

const MAX_DOC_SIZE_BYTES = 10 * 1024 * 1024; // 10MB limit

const SENSITIVE_PATTERNS = [
  /password\s*[:=]\s*[^\s]+/i,
  /api[_-]?key\s*[:=]\s*[^\s]+/i,
  /bearer\s+[a-z0-9_\-\.]+/i,
  /-----BEGIN\s+(RSA|EC|DSA|OPENSSH|PRIVATE)\s+KEY-----/i
];

const MALICIOUS_OVERRIDE_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/i,
  /disregard\s+(all\s+)?(previous|prior|above)/i,
  /system\s*prompt\s*:\s*you\s+are/i,
  /you\s+are\s+now\s+(DAN|unrestricted|jailbroken)/i,
  /override\s+all\s+(system|security)\s+rules/i,
  /<\/?system>/i,
  /<\/?instructions>/i
];

export class DocumentSanitizer {
  /**
   * Validates document size and inspects content for credentials or malicious instructions.
   */
  static validate(content, documentName = '') {
    if (!content || typeof content !== 'string') {
      throw new Error('Document validation failed: Content must be a non-empty string.');
    }

    const byteLength = Buffer.byteLength(content, 'utf8');
    if (byteLength > MAX_DOC_SIZE_BYTES) {
      throw new Error(`Document validation failed: File size (${Math.round(byteLength / 1024)} KB) exceeds maximum allowed 10MB.`);
    }

    // 1. Check for sensitive private credentials
    for (const pattern of SENSITIVE_PATTERNS) {
      if (pattern.test(content)) {
        throw new Error(`Security policy violation: Document '${documentName}' contains sensitive credentials or private keys.`);
      }
    }

    // 2. Check for malicious prompt injections
    for (const pattern of MALICIOUS_OVERRIDE_PATTERNS) {
      if (pattern.test(content)) {
        throw new Error(`Security policy violation: Document '${documentName}' contains potential prompt injection or system override instructions.`);
      }
    }

    return true;
  }

  /**
   * Normalizes document text for clean chunking and embedding.
   */
  static normalizeText(rawText) {
    if (!rawText) return '';
    return rawText
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove non-printable control characters
      .trim();
  }
}

