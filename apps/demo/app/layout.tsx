import "./globals.css";

export const metadata = {
  title: "crag demo",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <style>{`
          *, *::before, *::after { box-sizing: border-box; }
          body {
            margin: 0;
            padding: 0;
            font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
            height: 100dvh;
            overflow: hidden;
            background-color: #fff;
            color: #0d0d0d;
            -webkit-font-smoothing: antialiased;
          }
          ::-webkit-scrollbar { width: 6px; }
          ::-webkit-scrollbar-track { background: transparent; }
          ::-webkit-scrollbar-thumb { background: #c5c5d2; border-radius: 3px; }
          ::-webkit-scrollbar-thumb:hover { background: #a1a1aa; }
          @keyframes pulse-dot {
            0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
            40% { opacity: 1; transform: scale(1); }
          }
          @keyframes slide-in-right {
            from { transform: translateX(100%); }
            to { transform: translateX(0); }
          }
          @keyframes fade-in {
            from { opacity: 0; }
            to { opacity: 1; }
          }
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
