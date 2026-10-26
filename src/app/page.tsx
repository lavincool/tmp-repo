import Link from "next/link";
import { Button } from "@heroui/react";

export default function HomePage() {
  return (
    <section className="flex flex-col items-start justify-center pt-16 sm:pt-24 max-w-[680px]">
      <h1 className="text-[36px] sm:text-[56px] font-semibold leading-[1.1] tracking-[-0.02em] text-[#1D1D1F]">
        Caras conocidas. Sin complicaciones.
      </h1>
      <p className="mt-5 text-[18px] sm:text-[20px] text-[#6E6E73] leading-relaxed">
        Registra un rostro y encuéntralo en otra fotografía.
      </p>

      <div className="mt-8 sm:mt-10 flex flex-wrap items-center gap-4">
        <Link href="/recognize">
          <Button
            variant="primary"
            className="h-11 px-6 rounded-full bg-[#0071E3] hover:bg-[#0066CC] text-[#FFFFFF] text-[15px] font-medium transition-colors duration-150 shadow-none cursor-pointer"
          >
            Reconocer rostros
          </Button>
        </Link>
        <Link href="/people/new">
          <Button
            variant="secondary"
            className="h-11 px-6 rounded-full bg-[#F5F5F7] hover:bg-[#E5E5EA] text-[#1D1D1F] text-[15px] font-medium transition-colors duration-150 shadow-none cursor-pointer"
          >
            Registrar un rostro
          </Button>
        </Link>
      </div>
    </section>
  );
}
