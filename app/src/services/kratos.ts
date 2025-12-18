import { Configuration, FrontendApi, Identity, IdentityApi, Session } from '@ory/client';
import { config } from '../config';

// Frontend API - for session validation (uses public URL)
const frontendApi = new FrontendApi(
  new Configuration({
    basePath: config.kratosPublicUrl,
  })
);

// Identity API - for admin operations (uses admin URL)
const identityApi = new IdentityApi(
  new Configuration({
    basePath: config.kratosAdminUrl,
  })
);

export interface KratosSession {
  session: Session;
  identity: Identity;
}

/**
 * Validates a session by calling Kratos /sessions/whoami
 * The cookie is forwarded from the incoming request
 */
export async function validateSession(cookie: string): Promise<KratosSession | null> {
  try {
    const response = await frontendApi.toSession({
      cookie,
    });
    
    if (response.data && response.data.identity) {
      return {
        session: response.data,
        identity: response.data.identity,
      };
    }
    return null;
  } catch (error: unknown) {
    // Session is invalid or expired
    const err = error as { response?: { status?: number } };
    if (err.response?.status === 401) {
      return null;
    }
    console.error('Error validating session:', error);
    return null;
  }
}

/**
 * Get all identities from Kratos (admin API)
 */
export async function listIdentities(): Promise<Identity[]> {
  try {
    const response = await identityApi.listIdentities({
      pageSize: 250,
    });
    return response.data;
  } catch (error) {
    console.error('Error listing identities:', error);
    return [];
  }
}

/**
 * Get a single identity by ID (admin API)
 */
export async function getIdentity(identityId: string): Promise<Identity | null> {
  try {
    const response = await identityApi.getIdentity({
      id: identityId,
    });
    return response.data;
  } catch (error) {
    console.error('Error getting identity:', error);
    return null;
  }
}

/**
 * Extract email from identity traits
 */
export function getEmailFromIdentity(identity: Identity): string {
  const traits = identity.traits as Record<string, unknown>;
  return (traits?.email as string) || '';
}

/**
 * Extract name from identity traits
 * GitLab provides name as a single string field
 */
export function getNameFromIdentity(identity: Identity): string {
  const traits = identity.traits as Record<string, unknown>;
  return (traits?.name as string) || '';
}

/**
 * Extract picture URL from identity traits
 */
export function getPictureFromIdentity(identity: Identity): string {
  const traits = identity.traits as Record<string, unknown>;
  return (traits?.picture as string) || '';
}
