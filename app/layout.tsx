import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Secret Carshalton",
  description: "Secret Carshalton — news, events and things to do.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <Link href="/">Secret Carshalton</Link>
          <Link href="/events">What&apos;s On</Link>
        </header>
        {children}
      </body>
    </html>
  );
}
