import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI Avatar Studio',
  description: 'Speaking VRM avatar powered by a free LLM and browser TTS.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
