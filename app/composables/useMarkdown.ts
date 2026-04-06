import { marked } from 'marked'

export function useMarkdown() {
  return {
    parse: (md: string) => (md ? marked.parse(md, { gfm: true }) : ''),
  }
}
