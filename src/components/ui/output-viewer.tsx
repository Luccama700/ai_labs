'use client';

import { useState, useMemo } from 'react';
import { Button } from './button';

interface OutputViewerProps {
  output: string;
  maxHeight?: string;
}

/**
 * Extract SVG content from text (handles both raw SVG and code-fenced SVG)
 */
function extractSvg(text: string): { svg: string | null; hasSvg: boolean } {
  // Normalize line endings
  const normalizedText = text.replace(/\r\n/g, '\n');
  
  // First, try to extract from code blocks
  // Remove code blocks and check their content
  const codeBlockRegex = /```(?:svg|xml|html)?\s*\n?([\s\S]*?)\n?```|~~~(?:svg|xml|html)?\s*\n?([\s\S]*?)\n?~~~/g;
  
  let match;
  while ((match = codeBlockRegex.exec(normalizedText)) !== null) {
    const content = match[1] || match[2];
    if (content) {
      const svg = findSvgInText(content);
      if (svg) {
        return { svg, hasSvg: true };
      }
    }
  }
  
  // Try to find raw SVG (not in code block)
  const svg = findSvgInText(normalizedText);
  if (svg) {
    return { svg, hasSvg: true };
  }
  
  return { svg: null, hasSvg: false };
}

/**
 * Find SVG in text by locating opening and closing tags
 */
function findSvgInText(text: string): string | null {
  const svgStartIndex = text.indexOf('<svg');
  if (svgStartIndex === -1) {
    // Also try uppercase
    const upperIndex = text.indexOf('<SVG');
    if (upperIndex === -1) return null;
  }
  
  const startIndex = text.toLowerCase().indexOf('<svg');
  if (startIndex === -1) return null;
  
  // Find the matching closing tag
  // We need to handle nested SVG elements (rare but possible)
  let depth = 0;
  let i = startIndex;
  
  while (i < text.length) {
    const lowerText = text.toLowerCase();
    
    // Check for opening svg tag
    if (lowerText.substring(i, i + 4) === '<svg') {
      depth++;
      i += 4;
      continue;
    }
    
    // Check for self-closing svg (unlikely but possible)
    if (depth > 0 && text.substring(i, i + 2) === '/>') {
      // Check if we're inside an svg tag
      const lastOpen = text.lastIndexOf('<', i);
      if (lastOpen !== -1 && lowerText.substring(lastOpen, lastOpen + 4) === '<svg') {
        depth--;
        if (depth === 0) {
          return text.substring(startIndex, i + 2);
        }
      }
      i += 2;
      continue;
    }
    
    // Check for closing svg tag
    if (lowerText.substring(i, i + 6) === '</svg>') {
      depth--;
      if (depth === 0) {
        return text.substring(startIndex, i + 6);
      }
      i += 6;
      continue;
    }
    
    i++;
  }
  
  return null;
}

/**
 * Sanitize SVG to prevent XSS attacks and ensure it has proper dimensions
 */
function sanitizeSvg(svg: string): string {
  // Remove script tags
  let sanitized = svg.replace(/<script[\s\S]*?<\/script>/gi, '');
  // Remove event handlers
  sanitized = sanitized.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '');
  // Remove javascript: URLs
  sanitized = sanitized.replace(/javascript:/gi, '');
  
  // If SVG has viewBox but no width/height, add them for proper rendering
  // This ensures SVGs render properly in flex containers
  const hasViewBox = /viewBox\s*=\s*["'][^"']+["']/i.test(sanitized);
  const hasWidth = /\swidth\s*=\s*["'][^"']+["']/i.test(sanitized);
  const hasHeight = /\sheight\s*=\s*["'][^"']+["']/i.test(sanitized);
  
  if (hasViewBox && (!hasWidth || !hasHeight)) {
    // Extract viewBox dimensions to use as defaults
    const viewBoxMatch = sanitized.match(/viewBox\s*=\s*["']([^"']+)["']/i);
    if (viewBoxMatch) {
      const parts = viewBoxMatch[1].trim().split(/[\s,]+/);
      if (parts.length >= 4) {
        const vbWidth = parts[2];
        const vbHeight = parts[3];
        
        // Add width and height attributes if missing
        if (!hasWidth && !hasHeight) {
          sanitized = sanitized.replace(
            /<svg/i,
            `<svg width="${vbWidth}" height="${vbHeight}"`
          );
        } else if (!hasWidth) {
          sanitized = sanitized.replace(/<svg/i, `<svg width="${vbWidth}"`);
        } else if (!hasHeight) {
          sanitized = sanitized.replace(/<svg/i, `<svg height="${vbHeight}"`);
        }
      }
    }
  }
  
  return sanitized;
}

export function OutputViewer({ output, maxHeight = '400px' }: OutputViewerProps) {
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'text' | 'svg'>('text');
  
  const { svg, hasSvg } = useMemo(() => extractSvg(output), [output]);
  const sanitizedSvg = useMemo(() => svg ? sanitizeSvg(svg) : null, [svg]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleCopySvg = async () => {
    if (!svg) return;
    try {
      await navigator.clipboard.writeText(svg);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy SVG:', err);
    }
  };

  return (
    <div className="space-y-2">
      {/* Controls */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1">
          {hasSvg && (
            <>
              <button
                onClick={() => setViewMode('text')}
                className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                  viewMode === 'text'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
                }`}
              >
                Text
              </button>
              <button
                onClick={() => setViewMode('svg')}
                className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                  viewMode === 'svg'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
                }`}
              >
                SVG Preview
              </button>
            </>
          )}
        </div>
        <div className="flex gap-1">
          {hasSvg && viewMode === 'svg' && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopySvg}
              className="text-xs"
            >
              {copied ? '✓ Copied!' : 'Copy SVG'}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="text-xs"
          >
            {copied ? '✓ Copied!' : 'Copy All'}
          </Button>
        </div>
      </div>

      {/* Content */}
      {viewMode === 'text' ? (
        <pre
          className="overflow-auto whitespace-pre-wrap rounded-md bg-gray-100 p-3 text-sm dark:bg-gray-800"
          style={{ maxHeight }}
        >
          {output}
        </pre>
      ) : sanitizedSvg ? (
        <div className="space-y-2">
          {/* SVG Preview */}
          <div
            className="flex items-center justify-center overflow-auto rounded-md border bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
            style={{ maxHeight }}
          >
            <div
              className="svg-container"
              dangerouslySetInnerHTML={{ __html: sanitizedSvg }}
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
              }}
            />
          </div>
          {/* SVG Code (collapsed) */}
          <details className="text-sm">
            <summary className="cursor-pointer text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300">
              View SVG code
            </summary>
            <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-md bg-gray-100 p-2 text-xs dark:bg-gray-800">
              {svg}
            </pre>
          </details>
        </div>
      ) : (
        <pre
          className="overflow-auto whitespace-pre-wrap rounded-md bg-gray-100 p-3 text-sm dark:bg-gray-800"
          style={{ maxHeight }}
        >
          {output}
        </pre>
      )}
    </div>
  );
}
