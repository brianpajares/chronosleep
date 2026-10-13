import type { ReactNode } from 'react';

/**
 * Minimal, safe markdown renderer for Drive-served docs (headings, lists, paragraphs, **bold**,
 * [links](https://…) and bare URLs). No HTML passthrough; only http(s) links.
 */
function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\[[^\]]+\]\(https?:\/\/[^)\s]+\)|https?:\/\/[^\s)]+)/g;
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(re)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push(text.slice(last, idx));
    const tok = m[0];
    const key = `${keyBase}-${i++}`;
    if (tok.startsWith('**')) out.push(<strong key={key}>{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith('[')) {
      const mm = /^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/.exec(tok);
      out.push(
        <a key={key} href={mm?.[2]} target="_blank" rel="noopener noreferrer">
          {mm?.[1]}
        </a>,
      );
    } else {
      out.push(
        <a key={key} href={tok} target="_blank" rel="noopener noreferrer" className="break-all">
          {tok}
        </a>,
      );
    }
    last = idx + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ source }: { source: string }) {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let para: string[] = [];
  let list: string[] = [];
  const flushPara = () => {
    if (para.length) blocks.push(<p key={`p${blocks.length}`}>{inline(para.join(' '), `p${blocks.length}`)}</p>);
    para = [];
  };
  const flushList = () => {
    if (list.length) {
      const k = blocks.length;
      blocks.push(
        <ul key={`l${k}`} className="list-disc space-y-1 pl-5">
          {list.map((li, i) => (
            <li key={i}>{inline(li, `l${k}-${i}`)}</li>
          ))}
        </ul>,
      );
    }
    list = [];
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flushPara();
      flushList();
    } else if (/^#{1,6}\s/.test(line)) {
      flushPara();
      flushList();
      const level = line.match(/^#+/)![0].length;
      const text = line.replace(/^#+\s*/, '');
      const cls = level <= 2 ? 'mt-6 text-xl font-bold' : 'mt-4 text-lg font-semibold';
      blocks.push(
        level <= 2 ? (
          <h3 key={`h${blocks.length}`} className={cls}>
            {text}
          </h3>
        ) : (
          <h4 key={`h${blocks.length}`} className={cls}>
            {text}
          </h4>
        ),
      );
    } else if (/^\s*[-*]\s+/.test(line)) {
      flushPara();
      list.push(line.replace(/^\s*[-*]\s+/, ''));
    } else {
      flushList();
      para.push(line.trim());
    }
  }
  flushPara();
  flushList();
  return <div className="space-y-3 text-base leading-relaxed [&_a]:font-medium">{blocks}</div>;
}
