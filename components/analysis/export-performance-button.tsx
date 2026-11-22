"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ExportPerformanceButton() {
  const exportPdf = () => {
    const originalTitle = document.title;
    const date = new Date().toISOString().slice(0, 10);
    document.title = `unsolvable-performance-${date}`;
    try {
      window.print();
    } finally {
      document.title = originalTitle;
    }
  };

  return <Button variant="outline" type="button" onClick={exportPdf}><Download />Export PDF</Button>;
}
