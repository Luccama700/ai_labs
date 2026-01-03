'use client';

import { useEffect } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createTest, TestState } from '@/app/actions/tests';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

const initialState: TestState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" isLoading={pending}>
      Create Test
    </Button>
  );
}

export default function NewTestPage() {
  const router = useRouter();
  const [state, formAction] = useFormState(createTest, initialState);

  useEffect(() => {
    if (state.success && state.testId) {
      router.push(`/tests/${state.testId}`);
    }
  }, [state.success, state.testId, router]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Create Test</h1>
          <p className="mt-1 text-gray-500 dark:text-gray-400">
            Define a new test to run against AI models
          </p>
        </div>
        <Link href="/tests">
          <Button variant="outline">Cancel</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Test Configuration</CardTitle>
          <CardDescription>
            Use {'{{variableName}}'} syntax in your prompt for dynamic variables
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-6">
            <Input
              label="Test Name"
              name="name"
              placeholder="e.g., Code Review Quality"
              required
            />
            
            <Textarea
              label="Description (optional)"
              name="description"
              placeholder="Describe what this test measures..."
              rows={2}
            />
            
            <Textarea
              label="Prompt"
              name="basePrompt"
              placeholder="Enter your prompt here. Use {{variable}} for dynamic values."
              rows={6}
              required
            />
            
            <Textarea
              label="Variables (JSON object, optional)"
              name="variables"
              placeholder='{"language": "Python", "task": "sorting algorithm"}'
              rows={3}
            />
            
            <div className="border-t pt-6 dark:border-gray-700">
              <h3 className="mb-4 font-medium text-gray-900 dark:text-white">
                Validation Rules (optional)
              </h3>
              
              <div className="space-y-4">
                <Input
                  label="Expected Contains"
                  name="expectedContains"
                  placeholder="Text that the output should contain"
                />
                
                <Textarea
                  label="JSON Schema (for structured outputs)"
                  name="jsonSchema"
                  placeholder='{"type": "object", "properties": {...}}'
                  rows={4}
                />
              </div>
            </div>
            
            {state.error && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">
                {state.error}
              </div>
            )}
            
            <div className="flex justify-end gap-2">
              <Link href="/tests">
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
              <SubmitButton />
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
