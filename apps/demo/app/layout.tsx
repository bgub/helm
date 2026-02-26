import "./globals.css";

export const metadata = {
  title: "bevel demo",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="h-dvh overflow-hidden bg-white text-[#0d0d0d] antialiased">
        {children}
      </body>
    </html>
  );
}
