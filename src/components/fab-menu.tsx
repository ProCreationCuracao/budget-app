"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import QuickAddSheet from "@/components/quick-add-sheet";
import type { QuickAddType } from "@/lib/offline-queue";

export default function FabMenu() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetType, setSheetType] = useState<QuickAddType>("expense");

  // No radial menu items in the simplified FAB

  // Removed global keyboard shortcuts to avoid interfering while typing

  function openSheet(type: QuickAddType) {
    setSheetType(type);
    setSheetOpen(true);
  }

  // Simplified interactions: single tap opens Quick Add sheet
  function onClickFab() { openSheet("expense"); }

  return (
    <div
      className="fixed sm:hidden z-[80]"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 80px)", right: "calc(env(safe-area-inset-right, 0px) + 16px)" }}
    >
      <div className="relative">
        {/* No radial menu in simplified FAB */}

        <motion.button
          aria-label="Add"
          onClick={onClickFab}
          onContextMenu={(e) => e.preventDefault()}
          className="inline-flex select-none items-center justify-center rounded-full h-14 w-14 bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] shadow-lg focus:outline-none focus:ring-2 focus:ring-[hsl(var(--accent)/0.45)]"
          style={{ touchAction: "manipulation" }}
        >
          <Plus className="h-5 w-5" />
        </motion.button>

        <QuickAddSheet open={sheetOpen} type={sheetType} onClose={() => setSheetOpen(false)} />
      </div>
    </div>
  );
}
