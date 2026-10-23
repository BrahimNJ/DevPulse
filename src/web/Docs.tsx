import type { JSX, ReactNode } from 'react';

import type { Messages } from './i18n.ts';
import { useI18n } from './I18nProvider.tsx';
import { Layout } from './Layout.tsx';
import { useQuota } from './quota.ts';

/** The blocks a documentation section is made of, as written in the language files. */
export type DocBlock =
  | { readonly type: 'p' | 'h3'; readonly text: string }
  | { readonly type: 'checks' | 'steps'; readonly items: readonly string[] }
  | {
      readonly type: 'table';
      readonly head: readonly string[];
      readonly rows: readonly (readonly string[])[];
    }
  | {
      readonly type: 'diagram';
      readonly nodes: readonly string[];
      readonly detail: string;
      readonly arrows: readonly string[];
      readonly side: readonly string[];
    }
  | { readonly type: 'button'; readonly text: string; readonly href: string };

/** JSON cannot carry literal types; a test checks every block against DocBlock. */
export function docBlocks(section: Messages['docs']['sections'][number]): readonly DocBlock[] {
  return section.blocks as unknown as readonly DocBlock[];
}

/**
 * Inline formatting of the language files: `**bold**` and `[label](https://…)` only.
 * The files hold no HTML, so nothing they contain can inject markup.
 */
export function richText(text: string): ReactNode[] {
  return text
    .split(/(\*\*[^*]+\*\*|\[[^\]]+\]\(https:\/\/[^)\s]+\))/g)
    .filter((part) => part !== '')
    .map((part, index) => {
      const bold = /^\*\*([^*]+)\*\*$/.exec(part)?.[1];
      if (bold !== undefined) {
        return <strong key={index}>{bold}</strong>;
      }
      const link = /^\[([^\]]+)\]\((https:\/\/[^)\s]+)\)$/.exec(part);
      if (link?.[1] !== undefined && link[2] !== undefined) {
        return (
          <a key={index} href={link[2]}>
            {link[1]}
          </a>
        );
      }
      return part;
    });
}

function BlockView({
  block,
  label,
}: {
  readonly block: DocBlock;
  readonly label: string;
}): JSX.Element {
  switch (block.type) {
    case 'diagram':
      return <Diagram block={block} label={label} />;
    case 'table':
      return (
        <table className="doc-table">
          <thead>
            <tr>
              {block.head.map((cell) => (
                <th key={cell} scope="col">
                  {cell}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map(([choice, why]) => (
              <tr key={choice}>
                <th scope="row">{choice}</th>
                <td>{why}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    case 'steps':
      return (
        <ol className="numbered">
          {block.items.map((item) => (
            <li key={item}>{richText(item)}</li>
          ))}
        </ol>
      );
    case 'checks':
      return (
        <ul className="check-list">
          {block.items.map((item) => (
            <li key={item}>{richText(item)}</li>
          ))}
        </ul>
      );
    case 'button':
      return (
        <a className="button button-primary" href={block.href}>
          {block.text}
        </a>
      );
    case 'h3':
      return <h3>{block.text}</h3>;
    case 'p':
      return <p>{richText(block.text)}</p>;
  }
}

function Diagram({
  block,
  label,
}: {
  readonly block: Extract<DocBlock, { type: 'diagram' }>;
  readonly label: string;
}): JSX.Element {
  const [browser, server, github] = block.nodes;
  const [https, apis] = block.arrows;
  return (
    <>
      <div className="diagram" role="img" aria-label={label}>
        <div className="diagram-node">{browser}</div>
        <div className="diagram-arrow">{https}</div>
        <div className="diagram-node diagram-main">
          {server}
          <small>{block.detail}</small>
        </div>
        <div className="diagram-arrow">{apis}</div>
        <div className="diagram-node">{github}</div>
      </div>
      <div className="diagram-side">
        {block.side.map((item) => (
          <span key={item}>{item}</span>
        ))}
      </div>
    </>
  );
}

export function Docs(): JSX.Element {
  const { t } = useI18n();
  const copy = t.docs;
  const { quota } = useQuota();
  return (
    <Layout page="docs" quota={quota}>
      <section className="app-hero docs-hero">
        <div className="container">
          <span className="kicker">{copy.kicker}</span>
          <h1>{copy.title}</h1>
          <p className="lede">{copy.lede}</p>
        </div>
      </section>
      <div className="container docs-layout">
        <nav className="docs-nav" aria-label={copy.onThisPage}>
          <span className="docs-nav-title">{copy.onThisPage}</span>
          <ol>
            {copy.sections.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`}>{section.title}</a>
              </li>
            ))}
          </ol>
        </nav>
        <article className="docs-content">
          {copy.sections.map((section) => (
            <section key={section.id} id={section.id} className="doc-section">
              <h2>
                <a href={`#${section.id}`} className="anchor" aria-hidden="true">
                  #
                </a>
                {section.title}
              </h2>
              {docBlocks(section).map((block, index) => (
                <BlockView key={index} block={block} label={copy.diagramLabel} />
              ))}
            </section>
          ))}
        </article>
      </div>
    </Layout>
  );
}
