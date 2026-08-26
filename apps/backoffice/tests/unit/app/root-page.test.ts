/**
 * C-02 (backoffice half) — behavioural half of the root-route fix.
 *
 * The source sweep in not-found.test.ts pins the shape; this file proves the
 * actual branch: no session -> /login, a session -> /admin. getSession() is
 * bound to next/headers' cookies() (request-context only — see the scope note
 * atop tests/unit/features/auth/session.test.ts), so it is mocked here rather
 * than exercised for real, exactly like next/navigation's redirect() has to be:
 * redirect() throws NEXT_REDIRECT under the hood, so the module under test is
 * driven through that same throwing contract instead of a real Next router.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const redirectMock = vi.fn((destination: string) => {
  throw new Error(`NEXT_REDIRECT:${destination}`);
});
vi.mock('next/navigation', () => ({
  redirect: (destination: string) => redirectMock(destination),
}));

const getSessionMock = vi.fn();
vi.mock('@/features/auth/lib/session', () => ({
  getSession: () => getSessionMock(),
}));

describe('RootPage — resolves "/" by session instead of 404ing', () => {
  beforeEach(() => {
    redirectMock.mockClear();
    getSessionMock.mockReset();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('sends an anonymous visitor to /login', async () => {
    getSessionMock.mockResolvedValue(null);
    const { default: RootPage } = await import('../../../src/app/page');
    await expect(RootPage()).rejects.toThrow('NEXT_REDIRECT:/login');
    expect(redirectMock).toHaveBeenCalledWith('/login');
    expect(redirectMock).toHaveBeenCalledTimes(1);
  });

  it('sends an authenticated visitor to /admin, not to the dashboard directly', async () => {
    getSessionMock.mockResolvedValue({
      userId: 'user-1',
      email: 'a@zephyraconsultora.com',
      name: 'Admin',
      role: 'admin',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    const { default: RootPage } = await import('../../../src/app/page');
    await expect(RootPage()).rejects.toThrow('NEXT_REDIRECT:/admin');
    expect(redirectMock).toHaveBeenCalledWith('/admin');
  });

  it('always calls getSession — the decision is never made without checking', async () => {
    getSessionMock.mockResolvedValue(null);
    const { default: RootPage } = await import('../../../src/app/page');
    await expect(RootPage()).rejects.toThrow();
    expect(getSessionMock).toHaveBeenCalledTimes(1);
  });
});
