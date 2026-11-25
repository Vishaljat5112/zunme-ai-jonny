/**
 * Kiaan AI Memory Types & Scopes (Step 8)
 * Explicit classification and scope definitions for multi-tier conversational memory.
 */

export const MEMORY_TYPES = {
  CONVERSATION: 'conversation', // Recent turns & conversation-level state
  USER: 'user',                 // Stable user preferences & communication style
  PROJECT: 'project',           // Software project architecture, rules & constraints
  TASK: 'task',                 // Ongoing task status, execution progress & decisions
  SOFTWARE: 'software',         // Software-specific preferences (e.g. CRM nErgy default view)
  SUMMARY: 'summary'            // Lossless condensed summary of long conversations
};

export const MEMORY_SCOPES = {
  USER: 'user',
  CONVERSATION: 'conversation',
  SOFTWARE: 'software',
  PROJECT: 'project',
  TASK: 'task'
};

export const ALLOWED_MEMORY_TYPES = Object.values(MEMORY_TYPES);

/**
 * Validates a memory record against required fields and allowed types.
 */
export function validateMemoryPayload({ userId, keyName, valueText, memoryType = MEMORY_TYPES.USER }) {
  if (!userId || typeof userId !== 'string' || !userId.trim()) {
    throw new Error('Memory validation error: Valid userId is required.');
  }
  if (!keyName || typeof keyName !== 'string' || !keyName.trim()) {
    throw new Error('Memory validation error: Valid keyName is required.');
  }
  if (!valueText || typeof valueText !== 'string' || !valueText.trim()) {
    throw new Error('Memory validation error: Valid valueText is required.');
  }
  if (!ALLOWED_MEMORY_TYPES.includes(memoryType)) {
    throw new Error(`Memory validation error: Invalid memoryType '${memoryType}'. Allowed: ${ALLOWED_MEMORY_TYPES.join(', ')}`);
  }
  return true;
}

