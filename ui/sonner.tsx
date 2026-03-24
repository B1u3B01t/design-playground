"use client";

import * as React from "react";
import dynamic from "next/dynamic";

const SonnerToaster = dynamic(async () => (await import("sonner")).Toaster, {
  ssr: false,
});

export function PlaygroundToaster() {
  return (
    <SonnerToaster
      theme="light"
      position="bottom-right"
      richColors={false}
      className="toaster group z-[1000]"
      toastOptions={{
        style: {
          fontFamily: 'var(--font-geist-sans), Geist, system-ui, sans-serif',
        },
        classNames: {
          toast:
            "group toast !bg-white !text-stone-800 !border !border-stone-200/80 !shadow-md !rounded-lg !py-2 !px-3 !min-h-0",
          title:
            "!text-stone-800 !text-xs !font-medium !leading-tight",
          description:
            "!text-stone-500 !text-[11px] !leading-tight",
          error:
            "!bg-white !text-stone-800 !border !border-red-200/80",
          actionButton:
            "!bg-stone-900 !text-white !text-xs !font-medium !rounded-lg !px-3 !py-1.5 hover:!bg-stone-700",
          cancelButton:
            "!bg-stone-100 !text-stone-600 !text-xs !font-medium !rounded-lg !px-3 !py-1.5 hover:!bg-stone-200",
          closeButton:
            "!border-stone-200 !text-stone-400 hover:!text-stone-700 hover:!bg-stone-100",
        },
      }}
    />
  );
}
