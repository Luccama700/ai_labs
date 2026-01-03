/**
 * Validation utilities for test pass/fail checking
 */

import Ajv from 'ajv';

const ajv = new Ajv({ allErrors: true, strict: false });

export interface ValidationResult {
  passed: boolean;
  notes: string;
}

/**
 * Check if output contains expected string
 */
export function validateContains(output: string, expectedContains: string): ValidationResult {
  const passed = output.includes(expectedContains);
  return {
    passed,
    notes: passed 
      ? `Output contains expected string` 
      : `Output does not contain: "${expectedContains.slice(0, 50)}${expectedContains.length > 50 ? '...' : ''}"`,
  };
}

/**
 * Validate output against JSON schema
 */
export function validateJsonSchema(output: string, schemaJson: string): ValidationResult {
  try {
    // Try to parse the output as JSON
    let outputJson: unknown;
    
    // First, try to extract JSON from the output (it might be wrapped in markdown)
    const jsonMatch = output.match(/```(?:json)?\s*([\s\S]*?)```/) || 
                      output.match(/(\{[\s\S]*\})/);
    
    if (jsonMatch) {
      try {
        outputJson = JSON.parse(jsonMatch[1].trim());
      } catch {
        outputJson = JSON.parse(output);
      }
    } else {
      outputJson = JSON.parse(output);
    }
    
    // Parse the schema
    const schema = JSON.parse(schemaJson);
    
    // Validate
    const validate = ajv.compile(schema);
    const valid = validate(outputJson);
    
    if (valid) {
      return {
        passed: true,
        notes: 'Output matches JSON schema',
      };
    } else {
      const errors = validate.errors?.map((e) => `${e.instancePath} ${e.message}`).join('; ');
      return {
        passed: false,
        notes: `Schema validation failed: ${errors}`,
      };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      passed: false,
      notes: `JSON validation error: ${message}`,
    };
  }
}

/**
 * Run all applicable validations
 */
export function validateOutput(
  output: string,
  expectedContains?: string | null,
  jsonSchema?: string | null
): ValidationResult | null {
  // If no validation rules, return null
  if (!expectedContains && !jsonSchema) {
    return null;
  }
  
  const results: ValidationResult[] = [];
  
  if (expectedContains) {
    results.push(validateContains(output, expectedContains));
  }
  
  if (jsonSchema) {
    results.push(validateJsonSchema(output, jsonSchema));
  }
  
  // Combine results - pass only if all validations pass
  const allPassed = results.every((r) => r.passed);
  const notes = results.map((r) => r.notes).join('; ');
  
  return {
    passed: allPassed,
    notes,
  };
}
