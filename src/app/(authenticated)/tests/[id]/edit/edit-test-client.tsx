'use client';

import { useEffect } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { updateTest, TestState } from '@/app/actions/tests';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface TestData {
  id: string;
  name: string;
  description: string | null;
  basePrompt: string;
  variables: string;
  modelConfigs: string;
  expectedContains: string | null;
  jsonSchema: string | null;
}

interface EditTestClientProps {
  test: TestData;
}

const initialState: TestState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" isLoading={pending}>
      Save Changes
    </Button>
  );
}

export function EditTestClient({ test }: EditTestClientProps) {
  const router = useRouter();
  const [state, formAction] = useFormState(updateTest, initialState);

  useEffect(() => {
    if (state.success) {
      router.push(`/tests/${test.id}`);
    }
  }, [state.success, test.id, router]);

  // Format JSON for display
  const formatJson = (json: string | null) => {
    if (!json) return '';
    try {
      return JSON.stringify(JSON.parse(json), null, 2);
    } catch {
      return json;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Edit Test</h1>
          <p className="mt-1 text-gray-500 dark:text-gray-400">
            Modify your test configuration
          </p>
        </div>
        <Link href={`/tests/${test.id}`}>
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
            {/* Hidden field for test ID */}
            <input type="hidden" name="id" value={test.id} />
            
            <Input
              label="Test Name"
              name="name"
              placeholder="e.g., Code Review Quality"
              defaultValue={test.name}
              required
            />
            
            <Textarea
              label="Description (optional)"
              name="description"
              placeholder="Describe what this test measures..."
              rows={2}
              defaultValue={test.description || ''}
            />
            
            <Textarea
              label="Prompt"
              name="basePrompt"
              placeholder="Enter your prompt here. Use {{variable}} for dynamic values."
              rows={6}
              defaultValue={test.basePrompt}
              required
            />
            
            <Textarea
              label="Variables (JSON object, optional)"
              name="variables"
              placeholder='{"language": "Python", "task": "sorting algorithm"}'
              rows={3}
              defaultValue={formatJson(test.variables)}
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
                  defaultValue={test.expectedContains || ''}
                />
                
                <Textarea
                  label="JSON Schema (for structured outputs)"
                  name="jsonSchema"
                  placeholder='{"type": "object", "properties": {...}}'
                  rows={4}
                  defaultValue={formatJson(test.jsonSchema)}
                />
              </div>
            </div>
            
            {state.error && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">
                {state.error}
              </div>
            )}
            
            <div className="flex justify-end gap-2">
              <Link href={`/tests/${test.id}`}>
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
