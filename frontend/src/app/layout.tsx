import "./globals.css";

export const metadata = {
  title: "Gemini Chat Prototype",
  description: "A simple chat prototype using Gemini API",
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
