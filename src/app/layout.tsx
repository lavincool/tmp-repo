import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

export const metadata: Metadata = {
  title: "Viso Faces — Reconocimiento Facial",
  description: "Registra un rostro y encuéntralo en otra fotografía con Viso Face y Vision.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="light" data-theme="light">
      <body className="min-h-screen bg-[#FBFBFD] text-[#1D1D1F] flex flex-col antialiased selection:bg-[#0071E3]/15">
        <SiteHeader />
        <main className="flex-1 max-w-[960px] w-full mx-auto px-5 sm:px-8 pt-12 pb-16">
          {children}
        </main>
      </body>
    </html>
  );
}
