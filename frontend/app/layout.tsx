import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { AuthLayout } from "@/components/auth-layout";
import { LocaleSync } from "@/components/locale-sync";
import { ClientOnly } from "@/components/client-only";

export const metadata: Metadata = {
  title: "SAGE",
  description: "SAGE: Santhigiri Administration & Governance Engine",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const fontFamily = '"Funnel Display", system-ui, -apple-system, sans-serif';
  return (
    <html lang="en" style={{ fontFamily }} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Funnel+Display:wght@300..800&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Manjari:wght@100;400;700&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Audiowide&family=Gugi&display=swap"
          rel="stylesheet"
        />
        {/* Set data-locale before paint when user previously chose Malayalam */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var d=localStorage.getItem('locale-storage');if(d){var j=JSON.parse(d);if(j.state&&j.state.locale==='ml'){document.documentElement.setAttribute('data-locale','ml');document.documentElement.lang='ml';}}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="antialiased" style={{ fontFamily }}>
        <ClientOnly>
          <LocaleSync />
          <AuthLayout>
            {children}
          </AuthLayout>
          <Toaster />
        </ClientOnly>
      </body>
    </html>
  );
}
