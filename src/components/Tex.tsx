import { memo, useMemo } from 'react';
import katex from 'katex';

interface TexProps {
  tex: string;
  display?: boolean;
  className?: string;
}

/** Renderiza TeX con KaTeX (throwOnError: false). Memoizado por la cadena de entrada. */
export const Tex = memo(function Tex({ tex, display = false, className }: TexProps) {
  const html = useMemo(
    () => katex.renderToString(tex, { displayMode: display, throwOnError: false, strict: 'ignore' }),
    [tex, display],
  );
  return display ? (
    <div className={`overflow-x-auto overflow-y-hidden py-1 ${className ?? ''}`} dangerouslySetInnerHTML={{ __html: html }} />
  ) : (
    <span className={className} dangerouslySetInnerHTML={{ __html: html }} />
  );
});
