// FIX: Replaced placeholder content with a functional dbService for localStorage.

// This is a simplified version of the type from types.ts to make this service self-contained.
interface ChatMessage {
  id: string;
  sender: 'user' | 'agent';
  content: {
    text: string;
    analysisResult?: any;
  };
}

/**
 * Saves the chat history for a specific file to localStorage.
 * @param key - A unique key, typically derived from the filename.
 * @param messages - The array of ChatMessage objects to save.
 */
export const saveChatHistory = (key: string, messages: ChatMessage[]): void => {
  try {
    const serializedMessages = JSON.stringify(messages);
    localStorage.setItem(key, serializedMessages);
  } catch (error) {
    console.error(`Failed to save chat history for key "${key}":`, error);
  }
};

/**
 * Retrieves and parses chat history from localStorage.
 * @param key - The unique key for the chat history to retrieve.
 * @returns An array of ChatMessage objects, or null if not found or if parsing fails.
 */
export const getChatHistory = (key: string): ChatMessage[] | null => {
  try {
    const serializedMessages = localStorage.getItem(key);
    if (serializedMessages === null) {
      return null;
    }
    const parsedMessages = JSON.parse(serializedMessages);
    if (Array.isArray(parsedMessages)) {
      return parsedMessages;
    }
    // Data is malformed, return null
    console.warn(`Data for key "${key}" in localStorage is not an array.`);
    return null;
  } catch (error) {
    console.error(`Failed to retrieve or parse chat history for key "${key}":`, error);
    // If parsing fails, it's safer to remove the corrupted data.
    localStorage.removeItem(key);
    return null;
  }
};

/**
 * Removes a specific chat history from localStorage.
 * @param key - The unique key for the chat history to remove.
 */
export const removeChatHistory = (key: string): void => {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error(`Failed to remove chat history for key "${key}":`, error);
  }
};
