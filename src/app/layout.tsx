import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bright Future | Scholarship Application",
  description: "Apply for a Bright Future scholarship and submit your application securely onchain.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
