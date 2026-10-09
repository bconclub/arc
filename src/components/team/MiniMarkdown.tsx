/**
 * Just enough Markdown for the playbook: #/##/### headings, - and 1. lists,
 * **bold**, *italic*, [links](https://…), > quotes and paragraphs (a single line
 * break inside a paragraph is kept). Builds React elements, never HTML strings,
 * so nothing in the text can inject markup.
 */
import { Fragment } from "react";

function inline(text: string, key: string) {
  const out: React.ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|\*([^*\s][^*]*)\*/g;
  let last = 0, m: RegExpExecArray | null, i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(m[1]
      ? <strong key={`${key}-${i++}`} className="font-semibold text-text">{m[1]}</strong>
      : m[4]
        ? <em key={`${key}-${i++}`}>{m[4]}</em>
        : <a key={`${key}-${i++}`} href={m[3]} target="_blank" rel="noreferrer" className="underline">{m[2]}</a>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function MiniMarkdown({ text }: { text: string }) {
  const blocks: React.ReactNode[] = [];
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  let list: { ordered: boolean; items: string[] } | null = null;
  let para: string[] = [];
  const flush = (k: number) => {
    if (para.length) { blocks.push(<p key={`p${k}`} className="whitespace-pre-line text-[13.5px] leading-relaxed text-text">{inline(para.join("\n"), `p${k}`)}</p>); para = []; }
    if (list) {
      const L = list.ordered ? "ol" : "ul";
      blocks.push(<L key={`l${k}`} className={`${list.ordered ? "list-decimal" : "list-disc"} space-y-1 pl-5 text-[13.5px] leading-relaxed text-text`}>
        {list.items.map((it, j) => <li key={j}>{inline(it, `l${k}-${j}`)}</li>)}
      </L>);
      list = null;
    }
  };
  lines.forEach((raw, k) => {
    const line = raw.trimEnd();
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    const li = line.match(/^\s*(?:[-*]|(\d+)\.)\s+(.*)$/);
    if (!line.trim()) return flush(k);
    const quote = line.match(/^>\s?(.*)$/);
    if (quote) {
      flush(k);
      blocks.push(<p key={`q${k}`} className="border-l-2 border-[var(--brand-line)] pl-3 text-[12.5px] text-text-muted">{inline(quote[1], `q${k}`)}</p>);
      return;
    }
    if (h) {
      flush(k);
      const cls = h[1].length === 1 ? "text-[20px] font-bold" : h[1].length === 2 ? "mt-3 text-[16px] font-semibold" : "mt-2 text-[14px] font-semibold";
      blocks.push(<p key={`h${k}`} role="heading" aria-level={h[1].length} className={`${cls} tracking-tight text-text`}>{inline(h[2], `h${k}`)}</p>);
      return;
    }
    if (li) {
      if (para.length) flush(k);
      const ordered = Boolean(li[1]);
      if (list && list.ordered !== ordered) flush(k);
      list = list || { ordered, items: [] };
      list.items.push(li[2]);
      return;
    }
    if (list) flush(k);
    para.push(line.trim());
  });
  flush(lines.length);
  return <div className="flex flex-col gap-2.5">{blocks.map((b, i) => <Fragment key={i}>{b}</Fragment>)}</div>;
}
