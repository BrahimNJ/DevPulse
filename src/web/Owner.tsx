import { useState, type JSX, type SyntheticEvent } from 'react';

import { ApiError, signInAsOwner, signOut } from './api.ts';
import { useI18n } from './I18nProvider.tsx';
import { KeyIcon } from './icons.tsx';
import { Layout } from './Layout.tsx';
import { useQuota } from './quota.ts';

/**
 * The maintainer's sign-in (ADR 0008). Not linked from anywhere: submitting the owner
 * key sets a signed cookie that lifts the daily allowance on this browser.
 */
export function Owner(): JSX.Element {
  const { t } = useI18n();
  const copy = t.owner;
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
          const invalid = error instanceof ApiError && error.status === 401;
          setMessage({ tone: 'error', text: invalid ? copy.invalid : t.app.errors.generic });
        },
      )
      .finally(() => {
        setBusy(false);
      });
  }

  function onSubmit(event: SyntheticEvent<HTMLFormElement, SubmitEvent>): void {
    event.preventDefault();
    run(signInAsOwner(key), copy.signedIn);
  }

  const signedIn = quota?.owner === true;

  return (
    <Layout page="owner" quota={quota}>
      <section className="app-hero">
        <div className="container narrow">
          <span className="kicker">{copy.kicker}</span>
          <h1>{copy.title}</h1>
          <p className="lede">{signedIn ? copy.signedInLede : copy.lede}</p>
          {signedIn ? (
            <button
              type="button"
              className="button button-ghost"
              disabled={busy}
              onClick={() => {
                run(signOut(), copy.signedOut);
              }}
            >
              {copy.signOut}
            </button>
          ) : (
            <form className="analyse-form" onSubmit={onSubmit}>
              <label className="input-with-icon">
                <KeyIcon />
                <span className="visually-hidden">{copy.keyLabel}</span>
                <input
                  type="password"
                  value={key}
                  onChange={(event) => {
                    setKey(event.target.value);
                  }}
                  placeholder={copy.keyLabel}
                  autoComplete="current-password"
                  required
                />
              </label>
              <button type="submit" className="button button-primary" disabled={busy}>
                {copy.signIn}
              </button>
            </form>
          )}
          {message !== null && (
            <p
              className={`notice notice-${message.tone === 'ok' ? 'ok' : 'error'}`}
              role={message.tone === 'ok' ? 'status' : 'alert'}
            >
              {message.text}
            </p>
          )}
        </div>
      </section>
    </Layout>
  );
}
