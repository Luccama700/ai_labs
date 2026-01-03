'use client';

import { useState, useEffect } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { createApiKey, testApiKey, deleteApiKey, toggleApiKeyActive, KeyState } from '@/app/actions/keys';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatRelativeTime } from '@/lib/utils';

const PROVIDERS = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'google', label: 'Google Gemini' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'local', label: 'Local/OpenAI-Compatible' },
];

interface ApiKeyData {
  id: string;
  name: string;
  provider: string;
  keyLastFour: string;
  baseUrl: string | null;
  isActive: boolean;
  lastTestedAt: Date | null;
  createdAt: Date;
}

interface KeysClientProps {
  initialKeys: ApiKeyData[];
}

const initialState: KeyState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" isLoading={pending}>
      Save API Key
    </Button>
  );
}

export function KeysClient({ initialKeys }: KeysClientProps) {
  const [keys, setKeys] = useState(initialKeys);
  const [showForm, setShowForm] = useState(false);
  const [testingKey, setTestingKey] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ keyId: string; success: boolean; message: string } | null>(null);
  const [selectedProvider, setSelectedProvider] = useState('openai');
  
  const [state, formAction] = useFormState(createApiKey, initialState);

  useEffect(() => {
    if (state.success) {
      setShowForm(false);
      // Refresh page to get updated keys
      window.location.reload();
    }
  }, [state.success]);

  const handleTest = async (keyId: string) => {
    setTestingKey(keyId);
    setTestResult(null);
    
    try {
      const result = await testApiKey(keyId);
      setTestResult({ keyId, ...result });
    } finally {
      setTestingKey(null);
    }
  };

  const handleDelete = async (keyId: string) => {
    if (!confirm('Are you sure you want to delete this API key?')) return;
    
    const result = await deleteApiKey(keyId);
    if (result.success) {
      setKeys(keys.filter((k) => k.id !== keyId));
    }
  };

  const handleToggle = async (keyId: string) => {
    const result = await toggleApiKeyActive(keyId);
    if (result.success) {
      setKeys(keys.map((k) => (k.id === keyId ? { ...k, isActive: !k.isActive } : k)));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">API Keys</h1>
          <p className="mt-1 text-gray-500 dark:text-gray-400">
            Manage your AI provider API keys securely
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : 'Add API Key'}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Add New API Key</CardTitle>
            <CardDescription>
              Your API key will be encrypted and stored securely. You won&apos;t be able to view it again after saving.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={formAction} className="space-y-4">
              <Input
                label="Name"
                name="name"
                placeholder="My OpenAI Key"
                required
              />
              <Select
                label="Provider"
                name="provider"
                options={PROVIDERS}
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value)}
                required
              />
              <Input
                label="API Key"
                name="apiKey"
                type="password"
                placeholder="sk-..."
                required
              />
              {selectedProvider === 'local' && (
                <Input
                  label="Base URL"
                  name="baseUrl"
                  placeholder="http://localhost:11434"
                />
              )}
              {state.error && (
                <div className="rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">
                  {state.error}
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
                <SubmitButton />
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Keys List */}
      <div className="space-y-4">
        {keys.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-gray-500 dark:text-gray-400">
                No API keys yet. Add one to get started.
              </p>
            </CardContent>
          </Card>
        ) : (
          keys.map((key) => (
            <Card key={key.id}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 dark:text-white">{key.name}</span>
                        <Badge variant={key.isActive ? 'success' : 'default'}>
                          {key.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {PROVIDERS.find((p) => p.value === key.provider)?.label} · ****{key.keyLastFour}
                        {key.baseUrl && ` · ${key.baseUrl}`}
                      </div>
                      <div className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                        Added {formatRelativeTime(key.createdAt)}
                        {key.lastTestedAt && ` · Tested ${formatRelativeTime(key.lastTestedAt)}`}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {testResult?.keyId === key.id && (
                      <Badge variant={testResult.success ? 'success' : 'error'}>
                        {testResult.message}
                      </Badge>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTest(key.id)}
                      disabled={testingKey === key.id}
                    >
                      {testingKey === key.id ? 'Testing...' : 'Test'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggle(key.id)}
                    >
                      {key.isActive ? 'Disable' : 'Enable'}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(key.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
