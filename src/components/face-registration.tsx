"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button, TextField, Label, Input, FieldError, Checkbox, Spinner } from "@heroui/react";
import { normalizeBrowserImage, type NormalizedImageResult } from "@/lib/client/image";
import type { ApiErrorResponse } from "@/lib/contracts";

export function FaceRegistration() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState<string>("");
  const [consent, setConsent] = useState<boolean>(false);
  const [normalizedImage, setNormalizedImage] = useState<NormalizedImageResult | null>(null);

  const [isNormalizing, setIsNormalizing] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    image?: string;
    consent?: string;
    general?: string;
  }>({});

  // Revoke object URL on unmount or replacement
  useEffect(() => {
    return () => {
      if (normalizedImage) {
        normalizedImage.release();
      }
    };
  }, [normalizedImage]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFieldErrors((prev) => ({ ...prev, image: undefined, general: undefined }));
    setIsNormalizing(true);

    try {
      const normalized = await normalizeBrowserImage(file);
      // Clean up previous image URL
      if (normalizedImage) {
        normalizedImage.release();
      }
      setNormalizedImage(normalized);
    } catch (err) {
      setFieldErrors((prev) => ({
        ...prev,
        image: err instanceof Error ? err.message : "Error al procesar la imagen seleccionada.",
      }));
    } finally {
      setIsNormalizing(false);
      // Reset input value so re-selecting the same file triggers change
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || isNormalizing) return;

    // Reset errors
    const errors: typeof fieldErrors = {};
    const trimmedName = name.trim();

    if (!trimmedName) {
      errors.name = "El nombre es obligatorio.";
    } else if (trimmedName.length > 64) {
      errors.name = "El nombre no puede superar los 64 caracteres.";
    }

    if (!normalizedImage) {
      errors.image = "Debe elegir una foto con un solo rostro.";
    }

    if (!consent) {
      errors.consent = "Debe aceptar el consentimiento para registrar este rostro.";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("name", trimmedName);
      formData.append("consent", "true");
      formData.append("image", normalizedImage!.blob, "portrait.jpg");

      const res = await fetch("/api/people", {
        method: "POST",
        body: formData,
      });

      const data = (await res.json()) as { faceId?: string } & ApiErrorResponse;

      if (!res.ok || !data.faceId) {
        throw new Error(data.error?.message || "No se pudo registrar el rostro en el servidor.");
      }

      // Success: navigate to people list
      router.push("/people");
    } catch (err) {
      setFieldErrors((prev) => ({
        ...prev,
        general: err instanceof Error ? err.message : "Ocurrió un error inesperado.",
      }));
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-[480px] mx-auto">
      <h1 className="text-[28px] sm:text-[32px] font-semibold text-[#1D1D1F] tracking-tight">
        Registra un rostro
      </h1>
      <p className="mt-2 text-[14px] text-[#6E6E73]">
        La imagen debe contener exactamente un rostro visible.
      </p>

      {/* General Error Banner */}
      {fieldErrors.general && (
        <div
          role="alert"
          className="mt-6 p-4 rounded-[10px] bg-[#F5F5F7] border border-[#D2D2D7] text-[14px] text-[#B42318] leading-relaxed"
        >
          {fieldErrors.general}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-6">
        {/* Name Field */}
        <TextField isInvalid={Boolean(fieldErrors.name)} className="flex flex-col gap-2">
          <Label className="text-[14px] font-medium text-[#1D1D1F]">Nombre</Label>
          <Input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (fieldErrors.name) {
                setFieldErrors((prev) => ({ ...prev, name: undefined }));
              }
            }}
            placeholder="Ej. Ada Lovelace"
            maxLength={64}
            disabled={isSubmitting}
            className="h-11 px-3.5 rounded-[10px] border border-[#D2D2D7] bg-[#FFFFFF] text-[16px] text-[#1D1D1F] placeholder:text-[#6E6E73]/60 focus:border-[#0071E3] focus:outline-none transition-colors"
          />
          {fieldErrors.name && (
            <FieldError className="text-[13px] text-[#B42318] mt-1">{fieldErrors.name}</FieldError>
          )}
        </TextField>

        {/* Portrait Upload Area */}
        <div className="flex flex-col gap-2">
          <span className="text-[14px] font-medium text-[#1D1D1F]">Fotografía del rostro</span>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png"
            onChange={handleFileChange}
            disabled={isSubmitting || isNormalizing}
            className="hidden"
            id="portrait-file-input"
          />

          {!normalizedImage ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              tabIndex={0}
              role="button"
              className={`w-full h-56 rounded-[16px] border-2 border-dashed border-[#D2D2D7] hover:border-[#0071E3] bg-[#F5F5F7]/50 hover:bg-[#F5F5F7] transition-all duration-150 flex flex-col items-center justify-center p-6 text-center cursor-pointer ${
                isNormalizing ? "opacity-60 cursor-wait" : ""
              }`}
            >
              {isNormalizing ? (
                <div className="flex flex-col items-center gap-2 text-[#6E6E73]">
                  <Spinner size="md" color="accent" />
                  <span className="text-[13px]">Procesando imagen…</span>
                </div>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-full bg-[#FFFFFF] border border-[#E5E5EA] flex items-center justify-center text-[#6E6E73] mb-3 shadow-sm">
                    <svg
                      aria-hidden="true"
                      className="w-6 h-6"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z"
                      />
                    </svg>
                  </div>
                  <span className="text-[15px] font-medium text-[#0071E3]">Elegir foto</span>
                  <span className="text-[13px] text-[#6E6E73] mt-1">JPEG o PNG hasta 3 MiB</span>
                </>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <div className="relative w-full max-w-[280px] aspect-[4/5] rounded-[16px] overflow-hidden border border-[#D2D2D7] bg-[#F5F5F7] shadow-sm">
                <Image
                  src={normalizedImage.previewUrl}
                  alt="Vista previa del rostro"
                  fill
                  unoptimized
                  className="object-cover"
                />
              </div>
              <Button
                variant="ghost"
                size="sm"
                isDisabled={isSubmitting}
                onPress={() => fileInputRef.current?.click()}
                className="mt-3 text-[13px] text-[#6E6E73] hover:text-[#1D1D1F] transition-colors cursor-pointer"
              >
                Cambiar foto
              </Button>
            </div>
          )}

          {fieldErrors.image && (
            <p className="text-[13px] text-[#B42318] mt-1">{fieldErrors.image}</p>
          )}
        </div>

        {/* Consent Checkbox */}
        <div className="flex flex-col gap-1.5 pt-2">
          <Checkbox
            isSelected={consent}
            onChange={(checked) => {
              setConsent(checked);
              if (fieldErrors.consent) {
                setFieldErrors((prev) => ({ ...prev, consent: undefined }));
              }
            }}
            isDisabled={isSubmitting}
            className="flex items-start cursor-pointer"
          >
            <Checkbox.Content className="flex items-start gap-3 cursor-pointer">
              <Checkbox.Control className="mt-0.5 shrink-0">
                <Checkbox.Indicator />
              </Checkbox.Control>
              <span className="text-[14px] text-[#1D1D1F] leading-snug select-none">
                Acepto registrar este rostro para reconocerlo en esta demo. El nombre aparecerá en
                la lista compartida.
              </span>
            </Checkbox.Content>
          </Checkbox>

          {fieldErrors.consent && (
            <p className="text-[13px] text-[#B42318] pl-7">{fieldErrors.consent}</p>
          )}
        </div>

        {/* Submit Button */}
        <div className="pt-2">
          <Button
            type="submit"
            variant="primary"
            fullWidth
            isDisabled={isSubmitting || isNormalizing}
            className="h-11 rounded-full bg-[#0071E3] hover:bg-[#0066CC] disabled:opacity-50 text-[#FFFFFF] text-[15px] font-medium transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-none"
          >
            {isSubmitting ? (
              <>
                <Spinner size="sm" color="current" />
                <span>Registrando rostro…</span>
              </>
            ) : (
              <span>Registrar rostro</span>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
