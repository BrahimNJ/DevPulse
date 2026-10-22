import { useState, type JSX, type SyntheticEvent } from 'react';

import { signInAsOwner, signOut } from './api.ts';
import { KeyIcon } from './icons.tsx';
import { Layout } from './Layout.tsx';
import { useQuota } from './quota.ts';

/**
 * The maintainer's sign-in (ADR 0008). Not linked from anywhere: submitting the owner
 * key sets a signed cookie that lifts the daily allowance on this browser.
 */
export function Owner(): JSX.Element {
  const { quota, refresh } = useQuota();
  const [key, setKey] = useState('');
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  function run(action: Promise<void>, success: string): void {
    setBusy(true);
    action
      .then(
        () => {
          setKey('');
          setMessage({ tone: 'ok', text: success });
          refresh();
        },
        (error: unknown) => {
          setMessage({
            tone: 'error',
            text: error instanceof Error ? error.message : String(error),
          });
        },
      )
      .finally(() => {
        setBusy(false);
      });
  }

  function onSubmit(event: SyntheticEvent<HTMLFormElement, SubmitEvent>): void {
    event.preventDefault();
    run(signInAsOwner(key), 'Signed in: no daily limit on this browser for 30 days.');
  }

  return (
    <Layout page="owner" quota={quota}>
      <section className="app-hero">
        <div className="container narrow">
          <span className="kicker">Maintainer</span>
          <h1>Owner access</h1>
          <p className="lede">
            {quota?.owner === true
              ? 'This browser is signed in as the owner.'
              : 'Enter the owner key to lift the daily allowance on this browser.'}
          </p>
          {quota?.owner === true ? (
            <button
              type="button"
              className="button button-ghost"
              disabled={busy}
              onClick={() => {
                run(signOut(), 'Signed out.');
              }}
            >
              Sign out
            </button>
          ) : (
            <form className="analyse-form" onSubmit={onSubmit}>
              <label className="input-with-icon">
                <KeyIcon />
                <span className="visually-hidden">Owner key</span>
                <input
                  type="password"
                  value={key}
                  onChange={(event) => {
                    setKey(event.target.value);
                  }}
                  placeholder="Owner key"
                  autoComplete="current-password"
                  required
                />
              </label>
              <button type="submit" className="button button-primary" disabled={busy}>
                Sign in
              </button>
            </form>
          )}
          {message !== null && (
            <p className={`notice notice-${message.tone === 'ok' ? 'ok' : 'error'}`} role="status">
              {message.text}
            </p>
          )}
        </div>
      </section>
    </Layout>
  );
}
