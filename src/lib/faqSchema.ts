/**
 * FAQ Schema generation for JSON-LD (schema.org FAQPage)
 * Supports recursive extraction of text from React nodes for schema generation.
 */

// Recursively extract plain text from a React node (for schema generation)
export function extractText(node: unknown): string {
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractText).join(' ');
  if (node && typeof node === 'object' && 'props' in node) {
    const el = node as { props?: { children?: unknown } };
    if (el.props?.children != null) return extractText(el.props.children);
  }
  return '';
}

export interface FAQItem {
  question: string;
  answer: unknown; // React.ReactNode or string
}

export interface FAQSection {
  title: string;
  items: FAQItem[];
}

export function generateFAQSchema(sections: FAQSection[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: sections.flatMap(section =>
      section.items.map(item => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: typeof item.answer === 'string'
            ? item.answer
            : extractText(item.answer),
        },
      }))
    ),
  };
}
