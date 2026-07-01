"use client"

import * as React from "react"
import { submitPublicForm } from "@/features/forms/actions"
import type { Form, FormField } from "@/types/database"
import { Loader2, CheckCircle2 } from "lucide-react"

interface PublicFormViewProps {
  form: Form
}

export function PublicFormView({ form }: PublicFormViewProps) {
  const [values, setValues] = React.useState<Record<string, string | boolean>>(
    {}
  )
  const [isPending, setIsPending] = React.useState(false)
  const [submitted, setSubmitted] = React.useState(false)
  const [successMessage, setSuccessMessage] = React.useState("")
  const [errorMessage, setErrorMessage] = React.useState("")

  function handleChange(fieldId: string, value: string | boolean) {
    setValues((prev) => ({ ...prev, [fieldId]: value }))
    if (errorMessage) setErrorMessage("")
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsPending(true)
    setErrorMessage("")

    const result = await submitPublicForm(form.id, values)

    if (result.error) {
      setErrorMessage(result.error)
      setIsPending(false)
      return
    }

    if (result.redirect_url) {
      window.location.href = result.redirect_url
      return
    }

    setSuccessMessage(result.message ?? "Thank you for your submission.")
    setSubmitted(true)
    setIsPending(false)
  }

  if (submitted) {
    return (
      <div className="w-full max-w-lg rounded-xl bg-white p-8 shadow-sm">
        <div className="flex flex-col items-center gap-4 text-center">
          <CheckCircle2 className="size-12 text-green-500" />
          <h2 className="text-xl font-semibold text-gray-900">
            {successMessage}
          </h2>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-lg rounded-xl bg-white p-8 shadow-sm">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">{form.name}</h1>
        {form.description && (
          <p className="mt-2 text-gray-500">{form.description}</p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {form.fields.map((field) => (
          <FieldRenderer
            key={field.id}
            field={field}
            value={values[field.id]}
            onChange={(value) => handleChange(field.id, value)}
          />
        ))}

        {errorMessage && (
          <p className="text-sm text-red-600">{errorMessage}</p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="mt-2 flex items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
        >
          {isPending && <Loader2 className="size-4 animate-spin" />}
          {form.settings.submit_button_text || "Submit"}
        </button>
      </form>
    </div>
  )
}

function FieldRenderer({
  field,
  value,
  onChange,
}: {
  field: FormField
  value: string | boolean | undefined
  onChange: (value: string | boolean) => void
}) {
  const labelId = `field-${field.id}`

  if (field.type === "checkbox") {
    return (
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          id={labelId}
          checked={!!value}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 size-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
        />
        <span className="text-sm text-gray-700">
          {field.label}
          {field.required && <span className="ml-0.5 text-red-500">*</span>}
        </span>
      </label>
    )
  }

  if (field.type === "select") {
    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={labelId} className="text-sm font-medium text-gray-700">
          {field.label}
          {field.required && <span className="ml-0.5 text-red-500">*</span>}
        </label>
        <select
          id={labelId}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
        >
          <option value="">{field.placeholder ?? "Select..."}</option>
          {field.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>
    )
  }

  if (field.type === "textarea") {
    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={labelId} className="text-sm font-medium text-gray-700">
          {field.label}
          {field.required && <span className="ml-0.5 text-red-500">*</span>}
        </label>
        <textarea
          id={labelId}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder ?? ""}
          required={field.required}
          rows={4}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
        />
      </div>
    )
  }

  // text, email, phone, number, date
  const inputType: Record<string, string> = {
    text: "text",
    email: "email",
    phone: "tel",
    number: "number",
    date: "date",
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={labelId} className="text-sm font-medium text-gray-700">
        {field.label}
        {field.required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      <input
        id={labelId}
        type={inputType[field.type] ?? "text"}
        value={(value as string) ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder ?? ""}
        required={field.required}
        className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
      />
    </div>
  )
}
