"use server";

import { FaceAnalyzerError, runFaceAnalysis } from "./face-analyzer";


/**
 * Processes a captured selfie image by sending it for face analysis.
 *
 * @param imageData The Base64 encoded string of the captured image.
 * @returns The results from the face analysis API.
 */
export async function processSelfie(imageData: string) {
  const requestId = crypto.randomUUID();

  if (!imageData || typeof imageData !== "string") {
    throw new Error(`Unable to analyze image. [request:${requestId}]`);
  }

  console.log("[FaceAnalysis] request.received", {
    requestId,
    size: imageData.length,
  });

  // Convert Base64 data URL to a Buffer
  // Regex removes the "data:image/jpeg;base64," prefix if present
  const base64String = imageData.replace(/^data:image\/\w+;base64,/, "");

  if (!base64String) {
    throw new Error(`Unable to analyze image. [request:${requestId}]`);
  }

  const imageBuffer = Buffer.from(base64String, "base64");

  if (!imageBuffer.length) {
    throw new Error(`Unable to analyze image. [request:${requestId}]`);
  }

  try {
    // Run the full 3-step analysis flow
    return await runFaceAnalysis(imageBuffer, { requestId });
  } catch (error) {
    if (error instanceof FaceAnalyzerError) {
      throw new Error(
        `Analysis failed (${error.code} at ${error.stage}). Please try again. [request:${error.requestId}]`
      );
    }
    throw new Error(`Analysis failed unexpectedly. Please try again. [request:${requestId}]`);
  }
}