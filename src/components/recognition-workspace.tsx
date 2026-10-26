"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { Button, Spinner } from "@heroui/react";
import { FaceOverlay } from "@/components/face-overlay";
import { normalizeBrowserImage, type NormalizedImageResult } from "@/lib/client/image";
import type { RecognizeResponseDto, ApiErrorResponse } from "@/lib/contracts";

export function RecognitionWorkspace() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const activeRequestIdRef = useRef<number>(0);

  const [normalizedImage, setNormalizedImage] = useState<NormalizedImageResult | null>(null);
  const [isNormalizing, setIsNormalizing] = useState<boolean>(false);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);

  const [analysisResult, setAnalysisResult] = useState<RecognizeResponseDto | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Clean up object URLs on unmount or file replacement
  useEffect(() => {
    return () => {
      if (normalizedImage) {
        normalizedImage.release();
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [normalizedImage]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Invalidate and cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    activeRequestIdRef.current += 1;

    // Changing the photo clears old results
    setAnalysisResult(null);
    setSelectedIndex(null);
    setErrorMessage(null);
    setIsNormalizing(true);

    try {
      const normalized = await normalizeBrowserImage(file);
      if (normalizedImage) {
        normalizedImage.release();
      }
      setNormalizedImage(normalized);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Error al procesar la fotografía seleccionada.",
      );
    } finally {
      setIsNormalizing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRecognize = async () => {
    if (!normalizedImage || isAnalyzing || isNormalizing) return;

    const requestId = activeRequestIdRef.current + 1;
    activeRequestIdRef.current = requestId;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setIsAnalyzing(true);
    setErrorMessage(null);
    setSelectedIndex(null);

    try {
      const formData = new FormData();
      formData.append("image", normalizedImage.blob, "query.jpg");

      const res = await fetch("/api/recognize", {
        method: "POST",
        body: formData,
        signal: abortController.signal,
      });

      const data = (await res.json()) as RecognizeResponseDto & ApiErrorResponse;

      // Discard late response if photo changed
      if (activeRequestIdRef.current !== requestId) {
        return;
      }

      if (!res.ok || ("error" in data && data.error)) {
        throw new Error(data.error?.message || "No se pudo realizar el reconocimiento facial.");
      }

      setAnalysisResult(data);
      if (data.faces.length > 0) {
        setSelectedIndex(data.faces[0].detectionIndex);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      if (activeRequestIdRef.current === requestId) {
        setErrorMessage(err instanceof Error ? err.message : "Error durante el análisis.");
      }
    } finally {
      if (activeRequestIdRef.current === requestId) {
        setIsAnalyzing(false);
      }
    }
  };

  const hasResults = analysisResult !== null;

  return (
    <div className="w-full">
      {/* Title */}
      <div className="pb-6 border-b border-[#E5E5EA]">
        <h1 className="text-[28px] sm:text-[32px] font-semibold text-[#1D1D1F] tracking-tight">
          Reconoce los rostros de tu foto
        </h1>
        <p className="mt-2 text-[14px] text-[#6E6E73]">
          Sube una fotografía para buscar coincidencias en la colección de personas registradas.
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png"
        onChange={handleFileChange}
        disabled={isAnalyzing || isNormalizing}
        className="hidden"
        id="recognize-file-input"
      />

      {/* Error Banner */}
      {errorMessage && (
        <div
          role="alert"
          className="mt-6 p-4 rounded-[10px] bg-[#F5F5F7] border border-[#D2D2D7] text-[14px] text-[#B42318] leading-relaxed"
        >
          {errorMessage}
        </div>
      )}

      {/* Partial Result Banner */}
      {analysisResult?.partial && (
        <div
          role="status"
          className="mt-6 p-4 rounded-[10px] bg-[#F5F5F7] border border-[#D2D2D7] text-[14px] text-[#6E6E73] leading-relaxed"
        >
          Resultados parciales: algunas búsquedas no pudieron completarse en el servicio.
        </div>
      )}

      {/* Initial state: No photo chosen */}
      {!normalizedImage && (
        <div className="mt-8">
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
            className={`w-full max-w-[560px] mx-auto h-72 rounded-[16px] border-2 border-dashed border-[#D2D2D7] hover:border-[#0071E3] bg-[#F5F5F7]/50 hover:bg-[#F5F5F7] transition-all duration-150 flex flex-col items-center justify-center p-8 text-center cursor-pointer ${
              isNormalizing ? "opacity-60 cursor-wait" : ""
            }`}
          >
            {isNormalizing ? (
              <div className="flex flex-col items-center gap-2 text-[#6E6E73]">
                <Spinner size="md" color="accent" />
                <span className="text-[14px]">Procesando imagen…</span>
              </div>
            ) : (
              <>
                <div className="w-14 h-14 rounded-full bg-[#FFFFFF] border border-[#E5E5EA] flex items-center justify-center text-[#6E6E73] mb-4 shadow-sm">
                  <svg
                    aria-hidden="true"
                    className="w-7 h-7"
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
                <span className="text-[16px] font-medium text-[#0071E3]">Elegir fotografía</span>
                <span className="text-[13px] text-[#6E6E73] mt-1.5 max-w-[340px]">
                  Formatos JPEG o PNG hasta 3 MiB. Se analizarán todos los rostros encontrados.
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Photo chosen, before recognition */}
      {normalizedImage && !hasResults && (
        <div className="mt-8 flex flex-col items-center">
          <div className="relative w-full max-w-[640px] rounded-[16px] overflow-hidden border border-[#D2D2D7] bg-[#F5F5F7] shadow-sm">
            <div
              style={{
                aspectRatio: `${normalizedImage.width} / ${normalizedImage.height}`,
              }}
              className="relative w-full"
            >
              <Image
                src={normalizedImage.previewUrl}
                alt="Fotografía para reconocimiento"
                fill
                unoptimized
                className="object-contain"
              />
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-4">
            <Button
              variant="primary"
              isDisabled={isAnalyzing}
              onPress={handleRecognize}
              className="h-11 px-7 rounded-full bg-[#0071E3] hover:bg-[#0066CC] disabled:opacity-50 text-[#FFFFFF] text-[15px] font-medium transition-colors cursor-pointer flex items-center gap-2 shadow-none"
            >
              {isAnalyzing ? (
                <>
                  <Spinner size="sm" color="current" />
                  <span>Reconociendo rostros…</span>
                </>
              ) : (
                <span>Reconocer rostros</span>
              )}
            </Button>
            <Button
              variant="ghost"
              isDisabled={isAnalyzing}
              onPress={() => fileInputRef.current?.click()}
              className="h-11 px-5 rounded-full text-[14px] font-medium text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-[#F5F5F7] transition-colors cursor-pointer"
            >
              Cambiar foto
            </Button>
          </div>
        </div>
      )}

      {/* Results View */}
      {normalizedImage && hasResults && (
        <div className="mt-8">
          {/* Utility action: Cambiar foto */}
          <div className="flex items-center justify-between pb-4">
            <span className="text-[14px] text-[#6E6E73]">
              {analysisResult.faces.length === 1
                ? "1 rostro detectado"
                : `${analysisResult.faces.length} rostros detectados`}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onPress={() => fileInputRef.current?.click()}
              className="text-[13px] text-[#0071E3] hover:underline cursor-pointer"
            >
              Cambiar foto
            </Button>
          </div>

          <div className="flex flex-col lg:flex-row gap-8 items-start">
            {/* Image with SVG Face Overlay */}
            <div className="flex-1 w-full rounded-[16px] overflow-hidden border border-[#D2D2D7] bg-[#1D1D1F] shadow-sm relative">
              <div
                style={{
                  aspectRatio: `${analysisResult.image.width} / ${analysisResult.image.height}`,
                }}
                className="relative w-full"
              >
                <Image
                  src={normalizedImage.previewUrl}
                  alt="Fotografía analizada con rostros detectados"
                  fill
                  unoptimized
                  className="object-contain"
                />
                <FaceOverlay
                  imageWidth={analysisResult.image.width}
                  imageHeight={analysisResult.image.height}
                  faces={analysisResult.faces}
                  selectedIndex={selectedIndex}
                  onSelectFace={(index) => setSelectedIndex(index)}
                />
              </div>
            </div>

            {/* Results Column (260-300px desktop, full width mobile) */}
            <div className="w-full lg:w-[300px] shrink-0">
              <h2 className="text-[16px] font-semibold text-[#1D1D1F] mb-3">Resultados</h2>

              {analysisResult.faces.length === 0 ? (
                <div className="p-5 rounded-[12px] bg-[#F5F5F7] text-center">
                  <p className="text-[14px] text-[#6E6E73]">
                    No se detectaron rostros en la fotografía.
                  </p>
                </div>
              ) : (
                <ul className="flex flex-col gap-2.5">
                  {analysisResult.faces.map((face) => {
                    const isSelected = selectedIndex === face.detectionIndex;

                    return (
                      <li
                        key={`result-row-${face.detectionIndex}`}
                        onClick={() => setSelectedIndex(face.detectionIndex)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelectedIndex(face.detectionIndex);
                          }
                        }}
                        tabIndex={0}
                        role="button"
                        aria-label={`Rostro ${face.detectionIndex + 1}`}
                        className={`p-3.5 rounded-[12px] border transition-all duration-150 cursor-pointer text-left focus:outline-none ${
                          isSelected
                            ? "bg-[#FFFFFF] border-[#0071E3] shadow-sm ring-1 ring-[#0071E3]"
                            : "bg-[#FFFFFF] border-[#E5E5EA] hover:border-[#D2D2D7]"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[12px] font-semibold text-[#6E6E73] uppercase tracking-wider">
                            Rostro {face.detectionIndex + 1}
                          </span>
                          {face.status === "matched" && (
                            <span className="text-[12px] font-medium text-[#0071E3]">
                              Similitud: {face.similarity.toFixed(1)}%
                            </span>
                          )}
                        </div>

                        <div className="mt-1.5">
                          {face.status === "matched" && (
                            <p className="text-[15px] font-semibold text-[#1D1D1F]">{face.name}</p>
                          )}

                          {face.status === "unknown" && (
                            <p className="text-[14px] font-medium text-[#6E6E73]">
                              Sin coincidencia
                            </p>
                          )}

                          {face.status === "failed" && (
                            <div>
                              <p className="text-[14px] font-medium text-[#B42318]">
                                No se pudo evaluar
                              </p>
                              {face.error.message && (
                                <p className="text-[12px] text-[#6E6E73] mt-0.5">
                                  {face.error.message}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
