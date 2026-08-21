"use client"

import { ImagePlus, Upload, X } from "lucide-react"
import { motion } from "motion/react"
import { useDropzone } from "react-dropzone"

type FileUploadProps = {
  files?: File[]
  previewUrl?: string | null
  error?: string | null
  onChange?: (files: File[]) => void
  onRemove?: () => void
}

export const FileUpload = ({
  files = [],
  previewUrl = null,
  error = null,
  onChange,
  onRemove,
}: FileUploadProps) => {
  const handleFileChange = (newFiles: File[]) => {
    if (newFiles[0]) onChange?.([newFiles[0]])
  }

  const { getRootProps, getInputProps, inputRef, isDragActive } = useDropzone({
    multiple: false,
    noClick: false,
    onDrop: handleFileChange,
  })

  return (
    <div className="w-full">
      <div
        {...getRootProps({
          className: "upload-dropzone",
          "data-drag-active": isDragActive,
          "data-invalid": Boolean(error),
        })}
      >
        <input {...getInputProps()} />
        {files[0] ? (
          <div className="upload-preview">
            {previewUrl ? (
              <img alt="Event preview" src={previewUrl} />
            ) : (
              <div className="upload-prompt">
                <ImagePlus aria-hidden="true" size={26} />
                <strong>{files[0].name}</strong>
              </div>
            )}
            <motion.button
              aria-label="Remove event image"
              className="upload-preview-remove"
              onClick={(event) => {
                event.stopPropagation()
                if (inputRef.current) inputRef.current.value = ""
                onRemove?.()
              }}
              title="Remove image"
              type="button"
              whileTap={{ scale: 0.95 }}
            >
              <X aria-hidden="true" size={16} />
            </motion.button>
          </div>
        ) : (
          <div className="upload-prompt">
            {isDragActive ? <Upload aria-hidden="true" size={27} /> : <ImagePlus aria-hidden="true" size={27} />}
            <strong>{isDragActive ? "Drop the image here" : "Add an event image"}</strong>
            <span>Drag and drop or choose a JPG, PNG, or WebP up to 5 MB.</span>
          </div>
        )}
      </div>
      {error ? <p className="form-error">{error}</p> : null}
    </div>
  )
}
