import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

// Ensure window.aistudio is available in the global scope for API key selection
// As per guidelines, window.aistudio is assumed to be pre-configured and available.
// Therefore, the global declaration should be removed to avoid type conflicts.

/**
 * Checks if a Gemini API key has been selected by the user.
 * @returns {Promise<boolean>} True if a key is selected, false otherwise.
 */
export async function hasGeminiApiKey(): Promise<boolean> {
  if (window.aistudio?.hasSelectedApiKey) {
    return await window.aistudio.hasSelectedApiKey();
  }
  return false;
}

/**
 * Opens the dialog for the user to select their Gemini API key.
 */
export async function openGeminiApiKeySelection(): Promise<void> {
  if (window.aistudio?.openSelectKey) {
    await window.aistudio.openSelectKey();
  } else {
    alert('AI Studio API key selection not available in this environment. Ensure `window.aistudio` is properly configured.');
  }
}

/**
 * Generates a response from the Gemini model based on the given prompt.
 * Handles API key selection and error conditions.
 * @param {string} prompt The text prompt to send to the Gemini model.
 * @returns {Promise<string | undefined>} The generated text response, or undefined if an error occurs.
 */
export async function generateGeminiReply(prompt: string): Promise<string | undefined> {
  try {
    // CRITICAL: Create a new GoogleGenAI instance right before making an API call
    // to ensure it always uses the most up-to-date API key from the dialog.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash', // Using gemini-2.5-flash for general text tasks
      contents: prompt,
    });
    return response.text;
  } catch (error: any) {
    console.error('Error generating Gemini reply:', error);
    // If the error message contains "Requested entity was not found.",
    // reset the key selection state and prompt the user to select a key again via openSelectKey().
    if (error.message && error.message.includes("Requested entity was not found.") && window.aistudio?.openSelectKey) {
        alert('Your Gemini API key might be invalid or expired. Please select it again to continue.');
        window.aistudio.openSelectKey();
    }
    // Provide a more user-friendly error message if the key is missing
    if (!process.env.API_KEY || process.env.API_KEY === 'YOUR_API_KEY') {
      alert('Gemini API Key is not configured. Please select your API key in settings or through the prompt.');
    }
    throw error; // Re-throw to be handled by the calling component
  }
}