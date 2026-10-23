# 0009. Offer the interface in French by default, and in English

- Status: accepted
- Date: 2026-10-23

## Context

DevPulse is a portfolio project, and most of the recruiters who read it are French,
many of them not technical. The web interface was English only (ADR 0006). The
command line, the API and the repository documentation are read by developers and stay
in English, as `CLAUDE.md` requires for everything published on GitHub.

## Decision

- **Default language:** the web interface opens in French. A switch in the header
  offers EN and FR; the choice is stored in `localStorage` under `devpulse.locale` and
  applied without a reload. Storage failures fall back to French.
- **Content:** every text of the interface lives in `src/web/locales/fr.json` and
  `src/web/locales/en.json`, imported as JSON modules. The English file defines the
  shape; the French file is typed against it, and tests fail if a key, a `{placeholder}`
  or a documentation block differs between them.
- **Terminology:** technical terms French developers use as they are (branch, commit,
  merge, pull request, repository, CI/CD, staging, rollback, cache, token) stay in
  English inside French sentences. French copy follows French typography, which a test
  checks for high punctuation.
- **Formatting:** dates, numbers, percentages, durations and plural forms use the
  standard `Intl` API with `fr-FR` or `en-GB`, so each language follows its own rules.
- **Rich text:** the documentation page renders typed blocks from the language files;
  inline markup is limited to `**bold**` and `https` links, so the files cannot inject
  HTML.
- **Errors:** the interface explains API failures from their status, in the visitor's
  language, instead of showing the server's English messages.

## Alternatives considered

- **Do nothing.** French recruiters read an English-only site.
- **An i18n library (i18next, react-intl, FormatJS).** Mature, but a dependency for two
  languages and a few hundred strings; `Intl` and a typed JSON file cover the need.
- **Language in the URL (`/fr/…`).** Better for search engines and shared links, but
  more routing for a site whose readers arrive through a link from a CV; possible
  later without changing the language files.
- **Detecting the browser language.** Most readers are French; a fixed default keeps
  the first impression predictable, and the switch is one click away.
- **Translating every technical term.** "Demande de fusion" or "dépôt" read as
  unnatural to French developers and would hide the vocabulary recruiters search for.

## Consequences

- Every new text needs both languages; the tests make a missing one fail CI.
- The static HTML is French, so a visitor who chose English sees French for the instant
  before the page renders.
- Shared links open in the reader's stored language, not the sender's.
- The CLI, the API's error messages and the repository documentation remain English.
- Extends ADR 0006.
