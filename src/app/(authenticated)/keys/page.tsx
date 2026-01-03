import { getApiKeys } from '@/app/actions/keys';
import { KeysClient } from './keys-client';

export default async function KeysPage() {
  const keys = await getApiKeys();
  
  return <KeysClient initialKeys={keys} />;
}
