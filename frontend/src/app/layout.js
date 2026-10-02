import './globals.css';

export const metadata = {
  title: 'Dhaka Tesla Pool',
  description: 'Share a seat. Split the fare. Survive Dhaka traffic.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
