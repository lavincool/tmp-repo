"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Button,
  Spinner,
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogBackdrop,
  AlertDialogContainer,
  AlertDialogDialog,
  AlertDialogHeader,
  AlertDialogHeading,
  AlertDialogBody,
  AlertDialogFooter,
} from "@heroui/react";
import type { PersonDto, PeopleListResponse, ApiErrorResponse } from "@/lib/contracts";

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "—";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function PeopleList() {
  const [people, setPeople] = useState<PersonDto[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Deletion state
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchPeople = useCallback(async (cursor?: string) => {
    try {
      if (cursor) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
      }
      setErrorMessage(null);

      const url = cursor ? `/api/people?cursor=${encodeURIComponent(cursor)}` : "/api/people";

      const res = await fetch(url, { method: "GET" });
      const data = (await res.json()) as PeopleListResponse & ApiErrorResponse;

      if (!res.ok) {
        throw new Error(data.error?.message || "No se pudo cargar la lista de personas.");
      }

      setPeople((prev) => (cursor ? [...prev, ...data.people] : data.people));
      setNextCursor(data.nextCursor);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Error inesperado al cargar personas.");
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    fetchPeople();
  }, [fetchPeople]);

  const handleDelete = async (faceId: string): Promise<boolean> => {
    setIsDeleting(true);
    setDeleteError(null);

    try {
      const res = await fetch(`/api/people/${encodeURIComponent(faceId)}`, {
        method: "DELETE",
      });
      const data = (await res.json()) as { success?: boolean } & ApiErrorResponse;

      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "No se pudo eliminar a la persona.");
      }

      // Success: remove from list
      setPeople((prev) => prev.filter((p) => p.faceId !== faceId));
      return true;
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Error al eliminar el registro.");
      return false;
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="w-full">
      {/* Header section with title and action */}
      <div className="flex items-center justify-between pb-6 border-b border-[#E5E5EA]">
        <h1 className="text-[28px] sm:text-[32px] font-semibold text-[#1D1D1F] tracking-tight">
          Personas
        </h1>
        <Link href="/people/new">
          <Button
            variant="primary"
            className="h-10 px-5 rounded-full bg-[#0071E3] hover:bg-[#0066CC] text-[#FFFFFF] text-[14px] font-medium transition-colors duration-150 cursor-pointer"
          >
            Registrar rostro
          </Button>
        </Link>
      </div>

      {/* Error alert banner */}
      {errorMessage && (
        <div
          role="alert"
          className="mt-6 p-4 rounded-[10px] bg-[#F5F5F7] border border-[#D2D2D7] text-[14px] text-[#B42318] flex items-center justify-between"
        >
          <span>{errorMessage}</span>
          <Button
            variant="ghost"
            size="sm"
            onPress={() => fetchPeople()}
            className="text-[13px] text-[#0071E3] hover:underline cursor-pointer"
          >
            Reintentar
          </Button>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="py-20 flex flex-col items-center justify-center gap-3 text-[#6E6E73]">
          <Spinner size="md" color="accent" />
          <p className="text-[14px]">Cargando personas registradas…</p>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !errorMessage && people.length === 0 && (
        <div className="py-20 flex flex-col items-center justify-center text-center">
          <p className="text-[16px] text-[#6E6E73]">Todavía no hay rostros registrados.</p>
          <Link href="/people/new" className="mt-4">
            <Button
              variant="secondary"
              className="h-10 px-5 rounded-full bg-[#F5F5F7] hover:bg-[#E5E5EA] text-[#1D1D1F] text-[14px] font-medium transition-colors duration-150 cursor-pointer"
            >
              Registrar un rostro
            </Button>
          </Link>
        </div>
      )}

      {/* Divided list */}
      {!isLoading && people.length > 0 && (
        <ul className="divide-y divide-[#E5E5EA]">
          {people.map((person) => (
            <li
              key={person.faceId}
              className="py-4 flex items-center justify-between transition-colors duration-150"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div
                  aria-hidden="true"
                  className="w-10 h-10 rounded-full bg-[#F5F5F7] border border-[#E5E5EA] flex items-center justify-center text-[14px] font-semibold text-[#1D1D1F] select-none shrink-0"
                >
                  {getInitials(person.name)}
                </div>
                <span className="text-[16px] font-medium text-[#1D1D1F] truncate">
                  {person.name}
                </span>
              </div>

              {/* Delete with HeroUI AlertDialog compound */}
              <AlertDialog>
                <AlertDialogTrigger>
                  <Button
                    variant="ghost"
                    size="sm"
                    onPress={() => setDeleteError(null)}
                    className="text-[14px] text-[#6E6E73] hover:text-[#B42318] transition-colors duration-150 cursor-pointer px-3 py-1.5 rounded-lg"
                  >
                    Eliminar
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogBackdrop className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                  <AlertDialogContainer className="w-full max-w-[420px]">
                    <AlertDialogDialog className="bg-[#FFFFFF] rounded-[20px] p-6 shadow-xl border border-[#D2D2D7] focus:outline-none">
                      {({ close }) => (
                        <>
                          <AlertDialogHeader>
                            <AlertDialogHeading className="text-[20px] font-semibold text-[#1D1D1F]">
                              ¿Eliminar a {person.name}?
                            </AlertDialogHeading>
                          </AlertDialogHeader>
                          <AlertDialogBody className="mt-2 text-[14px] text-[#6E6E73] leading-relaxed">
                            Esta acción eliminará el rostro indexado de la colección compartida. No
                            se puede deshacer.
                            {deleteError && (
                              <p className="mt-3 text-[#B42318] text-[13px]">{deleteError}</p>
                            )}
                          </AlertDialogBody>
                          <AlertDialogFooter className="mt-6 flex items-center justify-end gap-3">
                            <Button
                              variant="ghost"
                              isDisabled={isDeleting}
                              onPress={() => {
                                setDeleteError(null);
                                close();
                              }}
                              className="h-10 px-4 rounded-full text-[14px] font-medium text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-[#F5F5F7] transition-colors cursor-pointer"
                            >
                              Cancelar
                            </Button>
                            <Button
                              variant="danger"
                              isDisabled={isDeleting}
                              onPress={async () => {
                                const success = await handleDelete(person.faceId);
                                if (success) {
                                  close();
                                }
                              }}
                              className="h-10 px-5 rounded-full bg-[#B42318] hover:bg-[#911c13] text-[#FFFFFF] text-[14px] font-medium transition-colors cursor-pointer flex items-center gap-2"
                            >
                              {isDeleting && <Spinner size="sm" color="current" />}
                              <span>Eliminar</span>
                            </Button>
                          </AlertDialogFooter>
                        </>
                      )}
                    </AlertDialogDialog>
                  </AlertDialogContainer>
                </AlertDialogBackdrop>
              </AlertDialog>
            </li>
          ))}
        </ul>
      )}

      {/* Pagination: Cargar más */}
      {nextCursor && !isLoading && (
        <div className="pt-8 flex justify-center">
          <Button
            variant="secondary"
            isDisabled={isLoadingMore}
            onPress={() => fetchPeople(nextCursor)}
            className="h-10 px-6 rounded-full bg-[#F5F5F7] hover:bg-[#E5E5EA] text-[#1D1D1F] text-[14px] font-medium transition-colors duration-150 cursor-pointer flex items-center gap-2"
          >
            {isLoadingMore && <Spinner size="sm" color="current" />}
            <span>Cargar más</span>
          </Button>
        </div>
      )}
    </div>
  );
}
