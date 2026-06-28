"use client"

import { useState, useCallback, useTransition } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { parseCSV, mapCSVFields } from "@/lib/utils/csv"
import { CONTACT_FIELDS } from "../types"
import { importContacts } from "../actions"
import { toast } from "sonner"
import {
  Upload,
  FileSpreadsheet,
  ArrowRight,
  Check,
  Loader2,
  AlertCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface ImportCSVDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type Step = "upload" | "mapping" | "preview" | "importing" | "done"

const SKIP_VALUE = "__skip__"

export function ImportCSVDialog({ open, onOpenChange }: ImportCSVDialogProps) {
  const [step, setStep] = useState<Step>("upload")
  const [csvData, setCsvData] = useState<Record<string, string>[]>([])
  const [csvFields, setCsvFields] = useState<string[]>([])
  const [fieldMapping, setFieldMapping] = useState<
    Record<string, string | null>
  >({})
  const [isPending, startTransition] = useTransition()
  const [importResult, setImportResult] = useState<{
    imported: number
    failed: number
    errors: string[]
  } | null>(null)
  const [dragOver, setDragOver] = useState(false)

  function reset() {
    setStep("upload")
    setCsvData([])
    setCsvFields([])
    setFieldMapping({})
    setImportResult(null)
    setDragOver(false)
  }

  async function handleFile(file: File) {
    if (!file.name.endsWith(".csv")) {
      toast.error("Please select a CSV file")
      return
    }

    try {
      const result = await parseCSV(file)

      if (result.data.length === 0) {
        toast.error("CSV file is empty")
        return
      }

      setCsvData(result.data)
      setCsvFields(result.fields)

      // Auto-map fields
      const autoMapping = mapCSVFields(result.fields)
      setFieldMapping(autoMapping)
      setStep("mapping")
    } catch {
      toast.error("Failed to parse CSV file")
    }
  }

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const file = e.dataTransfer.files?.[0]
      if (file) handleFile(file)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleFile(file)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  // Map raw CSV rows to contact fields
  function getMappedRows(): Record<string, string | null>[] {
    return csvData.map((row) => {
      const mapped: Record<string, string | null> = {}
      for (const [csvField, contactField] of Object.entries(fieldMapping)) {
        if (contactField && contactField !== SKIP_VALUE) {
          mapped[contactField] = row[csvField] || null
        }
      }
      return mapped
    })
  }

  function handleImport() {
    const mappedRows = getMappedRows()

    startTransition(async () => {
      setStep("importing")
      const result = await importContacts(mappedRows)
      setImportResult(result)
      setStep("done")
    })
  }

  const previewRows = getMappedRows().slice(0, 5)
  const mappedFieldNames = Object.values(fieldMapping).filter(
    (v) => v && v !== SKIP_VALUE
  )

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!isPending) {
          onOpenChange(v)
          if (!v) reset()
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import Contacts</DialogTitle>
          <DialogDescription>
            {step === "upload" && "Upload a CSV file to import contacts."}
            {step === "mapping" && "Map your CSV columns to contact fields."}
            {step === "preview" && "Review the first 5 rows before importing."}
            {step === "importing" && "Importing contacts..."}
            {step === "done" && "Import complete."}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Upload */}
        {step === "upload" && (
          <div
            className={cn(
              "flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 transition-colors",
              dragOver
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25"
            )}
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <div className="rounded-full bg-muted p-3">
              <Upload className="size-5 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium">
                Drag and drop your CSV file here
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                or click to browse
              </p>
            </div>
            <label className="cursor-pointer">
              <input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileInput}
              />
              <span className="inline-flex h-7 items-center justify-center gap-1 rounded-lg border border-input bg-background px-2.5 text-sm font-medium hover:bg-muted transition-colors">
                Choose File
              </span>
            </label>
          </div>
        )}

        {/* Step 2: Field Mapping */}
        {step === "mapping" && (
          <div className="flex flex-col gap-4 max-h-80 overflow-y-auto">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <FileSpreadsheet className="size-3.5" />
              {csvData.length} rows detected, {csvFields.length} columns
            </div>
            {csvFields.map((field) => (
              <div
                key={field}
                className="grid grid-cols-[1fr_auto_1fr] items-center gap-2"
              >
                <Label className="text-sm truncate" title={field}>
                  {field}
                </Label>
                <ArrowRight className="size-3.5 text-muted-foreground" />
                <Select
                  value={fieldMapping[field] ?? SKIP_VALUE}
                  onValueChange={(v) =>
                    setFieldMapping((prev) => ({
                      ...prev,
                      [field]: v === SKIP_VALUE ? null : v,
                    }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Skip" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SKIP_VALUE}>Skip</SelectItem>
                    {CONTACT_FIELDS.map((cf) => (
                      <SelectItem key={cf.value} value={cf.value}>
                        {cf.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        )}

        {/* Step 3: Preview */}
        {step === "preview" && (
          <div className="overflow-x-auto max-h-72">
            <Table>
              <TableHeader>
                <TableRow>
                  {mappedFieldNames.map((field) => (
                    <TableHead key={field} className="text-xs">
                      {CONTACT_FIELDS.find((cf) => cf.value === field)
                        ?.label ?? field}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewRows.map((row, i) => (
                  <TableRow key={i}>
                    {mappedFieldNames.map((field) => (
                      <TableCell
                        key={field}
                        className="text-xs text-muted-foreground"
                      >
                        {(field && row[field]) ?? "-"}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {csvData.length > 5 && (
              <p className="text-xs text-muted-foreground mt-2 text-center">
                ...and {csvData.length - 5} more rows
              </p>
            )}
          </div>
        )}

        {/* Step 4: Importing */}
        {step === "importing" && (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Importing {csvData.length} contacts...
            </p>
          </div>
        )}

        {/* Step 5: Done */}
        {step === "done" && importResult && (
          <div className="flex flex-col gap-4 py-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-primary/10 p-2">
                <Check className="size-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">
                  {importResult.imported} contacts imported
                </p>
                {importResult.failed > 0 && (
                  <p className="text-xs text-destructive">
                    {importResult.failed} failed
                  </p>
                )}
              </div>
            </div>
            {importResult.errors.length > 0 && (
              <div className="flex items-start gap-2 rounded-lg bg-destructive/5 p-3">
                <AlertCircle className="size-4 text-destructive shrink-0 mt-0.5" />
                <div className="text-xs text-destructive space-y-1">
                  {importResult.errors.map((err, i) => (
                    <p key={i}>{err}</p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <DialogFooter>
          {step === "mapping" && (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  reset()
                }}
              >
                Back
              </Button>
              <Button
                onClick={() => setStep("preview")}
                disabled={mappedFieldNames.length === 0}
              >
                Preview
              </Button>
            </>
          )}
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={() => setStep("mapping")}>
                Back
              </Button>
              <Button onClick={handleImport} disabled={isPending}>
                Import {csvData.length} Contacts
              </Button>
            </>
          )}
          {step === "done" && (
            <Button
              onClick={() => {
                reset()
                onOpenChange(false)
              }}
            >
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
