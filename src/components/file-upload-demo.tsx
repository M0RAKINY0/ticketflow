"use client";
import { FileUpload } from "@/components/ui/file-upload";

export default function FileUploadDemo() {
  return (
    <div className="w-full max-w-4xl mx-auto min-h-96 border border-dashed bg-white dark:bg-black border-neutral-200 dark:border-neutral-800 rounded-lg">
      <FileUpload onChange={() => undefined} />
    </div>
  );
}
