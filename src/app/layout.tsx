import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ChatBridge',
  description: 'AI chat platform with third-party app integration',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
