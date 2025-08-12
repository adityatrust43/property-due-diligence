# Lambda v2 Logic Documentation

This document outlines the logic and prompting strategy used in the `lambda_v2` function.

## Overview

The `lambda_v2` function is designed to analyze property documents uploaded to an S3 bucket. It uses the Google Gemini API to extract key information from the documents and generate a JSON report.

## Core Logic

1.  **Image Extraction**: The function first retrieves all the images associated with a given S3 key. These images are expected to be PNG files representing the pages of the original PDF document.
2.  **Batched Processing**: To handle large documents, the images are processed in batches. The default batch size is 10 pages.
3.  **Task-Based Analysis**: The analysis is broken down into four distinct tasks:
    *   `propertySummary`: Generates a summary of the property, including the current owner and a brief description.
    *   `titleChain`: Extracts the chain of title from the documents, identifying all ownership transfers.
    *   `documentDetails`: Provides a detailed summary of each document, including its type, date, parties involved, and a narrative summary.
    *   `redFlags`: Identifies any potential issues or inconsistencies in the documents that may require further attention.
4.  **Two-Step Prompting Strategy**: For each task, a two-step prompting strategy is used:
    *   **Batch Prompt**: A prompt is sent to the Gemini API for each batch of images, asking it to analyze only the images in that batch and return a partial JSON result.
    *   **Synthesis Prompt**: After all batches have been processed, a final prompt is sent to the Gemini API, providing it with the partial results from all batches and asking it to synthesize them into a single, coherent JSON object.
5.  **JSON Extraction**: The function includes a helper function to extract the JSON object from the Gemini API's response, which may sometimes include additional text or markdown formatting.
6.  **Report Generation**: The final, synthesized JSON objects for all four tasks are combined into a single report, which is then uploaded to a separate S3 bucket.

## Prompting Strategy

The prompts are designed to be as specific as possible to ensure the Gemini API returns the desired output.

*   **`getBatchPrompt`**: This prompt provides the Gemini API with the context of the document (file name, page count) and the current batch number. It also includes the specific task to be performed and a critical instruction to return the entire response as a single, valid JSON object.
*   **`getSynthesisPrompt`**: This prompt provides the Gemini API with the partial results from all batches and asks it to synthesize them into a final, coherent JSON object. It also includes a critical instruction to return the entire response as a single, valid JSON object.
*   **Task-Specific Prompts**: Each of the four tasks has its own specific prompt that defines the desired JSON structure and provides examples of the expected output.

## Model

The `lambda_v2` function uses the `gemini-2.5-flash` model from the Google Generative AI API.
