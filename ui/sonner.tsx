"use client";

import * as React from "react";
import { Toaster as SonnerToaster } from "sonner";

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
            "group toast !bg-white !text-stone-800 !border !border-stone-200/80 !shadow-lg !rounded-xl !py-3 !px-4",
          title:
            "!text-stone-800 !text-sm !font-medium",
          description:
            "!text-stone-500 !text-xs",
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
