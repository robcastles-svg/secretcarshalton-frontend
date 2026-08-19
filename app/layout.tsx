import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Secret Carshalton",
  description: "Secret Carshalton — rebuilt front end (staging).",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
