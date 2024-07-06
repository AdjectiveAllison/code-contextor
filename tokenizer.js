import { AutoTokenizer } from "@xenova/transformers";

const tokenizerCache = new Map();

export async function tokenize(text, model) {
  try {
    if (!tokenizerCache.has(model)) {
      console.log(`Loading tokenizer for model: ${model}`);
      const tokenizer = await AutoTokenizer.from_pretrained(model);
      tokenizerCache.set(model, tokenizer);
    }

    const tokenizer = tokenizerCache.get(model);
    // console.log("Encoding text...");
    const encodedOutput = tokenizer.encode(text);

    // console.log("Encoded output:", JSON.stringify(encodedOutput, null, 2));

    if (!Array.isArray(encodedOutput)) {
      throw new Error(
        `Unexpected encoded output type: ${typeof encodedOutput}`,
      );
    }

    return {
      tokenIds: encodedOutput,
      tokens: encodedOutput.map((id) => tokenizer.decode([id])),
      tokenCount: encodedOutput.length,
    };
  } catch (error) {
    console.error(
      `Error loading or using tokenizer for model ${model}:`,
      error.message,
    );
    throw error;
  }
}
