import { useState, useCallback } from "react";
import { downloadFile } from "@/utils/exports";
import type { FileMetadata } from "@/backend";

export function useDownloadFile() {
  const [downloadingFileId, setDownloadingFileId] = useState<bigint | null>(
    null,
  );

  const download = useCallback(
    async (file: FileMetadata) => {
      if (downloadingFileId) return;
      setDownloadingFileId(file.id);
      try {
        await downloadFile(file);
      } finally {
        setDownloadingFileId(null);
      }
    },
    [downloadingFileId],
  );

  return { download, downloadingFileId };
}
