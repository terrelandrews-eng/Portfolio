// Shared markdown renderer (briefing, chat, what-now, review insights).

import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

const components = {
  h1: (p: any) => <h1 className="mb-3 text-xl font-semibold tracking-tight text-ink" {...p} />,
  h2: (p: any) => (
    <h2 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wider text-stone-400" {...p} />
  ),
  h3: (p: any) => <h3 className="mb-1 mt-4 text-sm font-semibold text-ink" {...p} />,
  p: (p: any) => <p className="mb-2 leading-relaxed" {...p} />,
  ul: (p: any) => <ul className="mb-3 list-disc space-y-1 pl-5" {...p} />,
  ol: (p: any) => <ol className="mb-3 list-decimal space-y-1 pl-5" {...p} />,
  li: (p: any) => <li className="leading-relaxed" {...p} />,
  strong: (p: any) => <strong className="font-semibold text-ink" {...p} />,
  a: (p: any) => <a className="text-accent underline underline-offset-2" {...p} />,
  code: (p: any) => <code className="rounded bg-stone-100 px-1 py-0.5 text-[0.85em]" {...p} />,
  blockquote: (p: any) => (
    <blockquote className="mb-2 border-l-2 border-accent/30 pl-3 text-stone-600" {...p} />
  ),
  table: (p: any) => <table className="mb-3 w-full text-left text-sm" {...p} />,
  th: (p: any) => <th className="border-b border-stone-200 py-1 pr-4 font-medium" {...p} />,
  td: (p: any) => <td className="border-b border-stone-100 py-1 pr-4" {...p} />,
  hr: () => <hr className="my-4 border-stone-200" />,
};

export function Md({ children }: { children: string }) {
  return (
    <div className="text-sm text-ink/90">
      <Markdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </Markdown>
    </div>
  );
}
