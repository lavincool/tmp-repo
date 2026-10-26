"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function SiteHeader() {
  const pathname = usePathname();

  const isPeople = pathname.startsWith("/people");
  const isRecognize = pathname.startsWith("/recognize");

  return (
    <header className="sticky top-0 z-40 w-full h-16 bg-[#FBFBFD]/80 backdrop-blur-md border-b border-[#E5E5EA]">
      <div className="max-w-[960px] mx-auto h-full px-5 sm:px-8 flex items-center justify-between">
        <Link
          href="/"
          className="text-[17px] font-semibold text-[#1D1D1F] tracking-tight hover:opacity-80 transition-opacity duration-150"
        >
          Viso Faces
        </Link>
        <nav aria-label="Navegación principal" className="flex items-center gap-6 sm:gap-8">
          <Link
            href="/people"
            className={`text-[14px] font-medium transition-colors duration-150 ${
              isPeople ? "text-[#0071E3]" : "text-[#6E6E73] hover:text-[#1D1D1F]"
            }`}
          >
            Personas
          </Link>
          <Link
            href="/recognize"
            className={`text-[14px] font-medium transition-colors duration-150 ${
              isRecognize ? "text-[#0071E3]" : "text-[#6E6E73] hover:text-[#1D1D1F]"
            }`}
          >
            Reconocer
          </Link>
        </nav>
      </div>
    </header>
  );
}
