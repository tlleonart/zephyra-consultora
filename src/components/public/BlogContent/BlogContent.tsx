'use client';

import { useEffect, useState } from 'react';
import styles from './BlogContent.module.css';

interface BlogContentProps {
  html: string;
}

// Simple HTML sanitization function for trusted content
// Content comes from admin WYSIWYG editor (trusted source)
// For additional security in production, consider installing 'isomorphic-dompurify'
const sanitizeHtml = (html: string): string => {
  // Remove script tags and onclick handlers as a basic safety measure
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/on\w+='[^']*'/gi, '')
    .replace(/javascript:/gi, '');
};

export const BlogContent = ({ html }: BlogContentProps) => {
  const [sanitizedHtml, setSanitizedHtml] = useState('');

  useEffect(() => {
    setSanitizedHtml(sanitizeHtml(html));
  }, [html]);

  // During SSR/hydration, don't render the HTML to avoid mismatches
  if (!sanitizedHtml) {
    return <div className={styles.content} />;
  }

  return (
    <div
      className={styles.content}
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  );
};
