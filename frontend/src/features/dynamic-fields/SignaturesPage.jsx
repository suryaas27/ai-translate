import React, { useState, useCallback, useEffect } from 'react'
import {
  Plus, ChevronDown, MoreHorizontal, ZoomIn, ZoomOut,
  Settings, Trash2, Pencil, X, Loader2, CheckCircle, AlertCircle,
  Upload, MessageSquare, FileText,
} from 'lucide-react'
import mammoth from 'mammoth'
import { templateApi, contractsApi } from './api'

// ─── Static constants ──────────────────────────────────────────────────────────

const INDIA_STATES = [
  { label: 'Andhra Pradesh', code: 'AP' },
  { label: 'Arunachal Pradesh', code: 'AR' },
  { label: 'Assam', code: 'AS' },
  { label: 'Bihar', code: 'BR' },
  { label: 'Chhattisgarh', code: 'CG' },
  { label: 'Goa', code: 'GA' },
  { label: 'Gujarat', code: 'GJ' },
  { label: 'Haryana', code: 'HR' },
  { label: 'Himachal Pradesh', code: 'HP' },
  { label: 'Jharkhand', code: 'JH' },
  { label: 'Karnataka', code: 'KA' },
  { label: 'Kerala', code: 'KL' },
  { label: 'Madhya Pradesh', code: 'MP' },
  { label: 'Maharashtra', code: 'MH' },
  { label: 'Manipur', code: 'MN' },
  { label: 'Meghalaya', code: 'ML' },
  { label: 'Mizoram', code: 'MZ' },
  { label: 'Nagaland', code: 'NL' },
  { label: 'Odisha', code: 'OD' },
  { label: 'Punjab', code: 'PB' },
  { label: 'Rajasthan', code: 'RJ' },
  { label: 'Sikkim', code: 'SK' },
  { label: 'Tamil Nadu', code: 'TN' },
  { label: 'Telangana', code: 'TS' },
  { label: 'Tripura', code: 'TR' },
  { label: 'Uttar Pradesh', code: 'UP' },
  { label: 'Uttarakhand', code: 'UK' },
  { label: 'West Bengal', code: 'WB' },
  { label: 'Delhi', code: 'DL' },
  { label: 'Jammu & Kashmir', code: 'JK' },
  { label: 'Ladakh', code: 'LA' },
  { label: 'Chandigarh', code: 'CH' },
  { label: 'Puducherry', code: 'PY' },
  { label: 'Andaman & Nicobar', code: 'AN' },
  { label: 'Dadra & Nagar Haveli and Daman & Diu', code: 'DD' },
  { label: 'Lakshadweep', code: 'LD' },
]

const STAMP_DUTY_PAID_BY = [
  { label: 'First Party', value: 'first_party_name' },
  { label: 'Second Party', value: 'second_party_name' },
]

const SIGN_METHODS = [
  { label: 'Electronic', value: 'ELECTRONIC' },
  { label: 'Aadhaar', value: 'AADHAAR' },
]

const SIGN_POSITIONS = [
  { label: 'Top Left', value: 'TOP_LEFT' },
  { label: 'Top Right', value: 'TOP_RIGHT' },
  { label: 'Bottom Left', value: 'BOTTOM_LEFT' },
  { label: 'Bottom Right', value: 'BOTTOM_RIGHT' },
]

const REMINDER_OPTIONS = [
  { label: 'Daily', value: 1 },
  { label: 'Every 2 days', value: 2 },
  { label: 'Weekly', value: 7 },
]

const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:border-primary-500 focus:ring-1 focus:ring-primary-500 placeholder:text-gray-400 outline-none'
const selectCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none bg-white'

// ─── Field validation ──────────────────────────────────────────────────────────

function detectFieldType(label) {
  const l = label.toLowerCase()
  if (/\b(email|e-?mail)\b/.test(l)) return 'email'
  if (/\b(phone|mobile|contact|tel|cell|whatsapp)\b/.test(l)) return 'phone'
  if (/\bpan\b/.test(l)) return 'pan'
  if (/\b(aadhaar|aadhar|uid)\b/.test(l)) return 'aadhaar'
  if (/\b(pin\s?code|zip|postal)\b/.test(l)) return 'pincode'
  if (/\b(date|dob|born|expiry|execution|signed?\s+on)\b/.test(l)) return 'date'
  if (/\b(amount|price|cost|salary|rent|value|fee|stamp|consideration|duty|sum|total|charges?|deposit|compensation)\b/.test(l)) return 'numeric'
  if (/\b(cin|gstin|gst|registration|licence|license|vehicle|passport|ration)\b/.test(l)) return 'alphanumeric'
  if (/\b(address|location|place|city|state|district|village|town|street|locality|area|premise|flat|plot|house|block)\b/.test(l)) return 'address'
  if (/\b(name|party|grantor|grantee|attorney|witness|notary|principal|agent|vendor|buyer|seller|landlord|tenant|employer|employee|guardian|nominee|signatory|authorized)\b/.test(l)) return 'name'
  return 'any'
}

function validateFieldValue(label, value) {
  const v = value.trim()
  if (!v) return ''
  const rule = detectFieldType(label)
  switch (rule) {
    case 'email':
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? '' : 'Enter a valid email address'
    case 'phone': {
      const digits = v.replace(/[\s\-+()]/g, '')
      return /^\d{10}$/.test(digits) || /^91\d{10}$/.test(digits) ? '' : 'Enter a valid 10-digit phone number'
    }
    case 'pan':
      return /^[A-Z]{5}[0-9]{4}[A-Z]$/i.test(v) ? '' : 'PAN must be in the format AAAAA0000A'
    case 'aadhaar':
      return /^\d{12}$/.test(v.replace(/\s/g, '')) ? '' : 'Aadhaar must be exactly 12 digits'
    case 'pincode':
      return /^\d{6}$/.test(v) ? '' : 'Pincode must be exactly 6 digits'
    case 'date':
      return isNaN(Date.parse(v)) ? 'Enter a valid date (e.g. 15 Jan 2025 or 2025-01-15)' : ''
    case 'numeric':
      return /^\d+(\.\d+)?$/.test(v) ? '' : 'Enter a valid number (digits only)'
    case 'alphanumeric':
      return /^[a-zA-Z0-9\s\-/]+$/.test(v) ? '' : 'Only letters, digits and hyphens are allowed'
    case 'name':
      return /^[a-zA-Z\s.\-']+$/.test(v) ? '' : 'Enter letters only (no digits or special characters)'
    case 'address':
      return /^[a-zA-Z0-9\s,.\-/#&']+$/.test(v) ? '' : 'Enter a valid address'
    default:
      return ''
  }
}

// ─── Template helpers ─────────────────────────────────────────────────────────

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function replaceBlanksInHtmlText(html, fields) {
  const BLANK = /_{3,}|-{3,}|\[_+\]|\(\s*\)|\{\{[^}]+\}\}|\$[A-Za-z]\w*/g
  let fieldIndex = 0
  return html.replace(/(<[^>]*>)|([^<]+)/g, (_match, tag, text) => {
    if (tag !== undefined) return tag
    if (!text) return ''
    return text.replace(BLANK, () => {
      if (fieldIndex >= fields.length) return '________'
      const marker = `{{${fields[fieldIndex].id}}}`
      fieldIndex++
      return marker
    })
  })
}

const A4_STYLE = {
  maxWidth: '794px',
  minHeight: '1123px',
  padding: '96px 96px',
  fontFamily: '"Calibri", "Segoe UI", "Helvetica Neue", sans-serif',
  boxShadow: '0 1px 3px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.10)',
}

function TemplatePreview({ templateText, templateHtml, fields, values }) {
  if (templateHtml) {
    const renderedHtml = templateHtml.replace(/\{\{(field_\d+)\}\}/g, (_match, fieldId) => {
      const value = values[fieldId]
      const field = fields.find((f) => f.id === fieldId)
      const display = value ? escapeHtml(value) : field ? `[${escapeHtml(field.label)}]` : '________'
      return `<span class="${value ? 'field-filled' : 'field-empty'}">${display}</span>`
    })
    return (
      <div className="min-h-full bg-gray-200 py-8 px-6 flex justify-center">
        <div className="mammoth-doc bg-white w-full" style={A4_STYLE} dangerouslySetInnerHTML={{ __html: renderedHtml }} />
      </div>
    )
  }
  const parts = templateText.split(/({{field_\d+}})/)
  return (
    <div className="min-h-full bg-gray-200 py-8 px-6 flex justify-center">
      <div className="bg-white w-full text-gray-900 text-[13px] leading-7 whitespace-pre-wrap" style={A4_STYLE}>
        {parts.map((part, idx) => {
          const match = part.match(/^{{(field_\d+)}}$/)
          if (match) {
            const fieldId = match[1]
            const value = values[fieldId]
            const field = fields.find((f) => f.id === fieldId)
            return (
              <span key={idx} className={[
                'rounded-sm px-0.5 transition-all',
                value
                  ? 'bg-primary-50 text-primary-700 font-semibold border-b-2 border-primary-400'
                  : 'bg-yellow-50 text-gray-400 border-b border-dashed border-amber-400',
              ].join(' ')}>
                {value || (field ? `[${field.label}]` : '________')}
              </span>
            )
          }
          return <span key={idx}>{part}</span>
        })}
      </div>
    </div>
  )
}

// ─── eStamp Modal ─────────────────────────────────────────────────────────────

function EStampModal({ onClose, onAdd, initialData, defaultFirstParty }) {
  const [form, setForm] = useState({
    first_party_name: initialData?.first_party_name ?? defaultFirstParty ?? '',
    second_party_name: initialData?.second_party_name ?? '',
    stamp_duty_paid_by: initialData?.stamp_duty_paid_by ?? 'first_party_name',
    description: initialData?.description ?? 'Lease Agreement',
    state_code: initialData?.state_code ?? 'KA',
    article_id: initialData?.article_id ? String(initialData.article_id) : '',
    consideration_amount: initialData?.consideration_amount ? String(initialData.consideration_amount) : '0',
    stamp_duty_amount: initialData?.stamp_duty_amount ? String(initialData.stamp_duty_amount) : '',
  })
  const [articles, setArticles] = useState([])
  const [articlesLoading, setArticlesLoading] = useState(false)
  const [articlesError, setArticlesError] = useState('')
  const [stampValues, setStampValues] = useState([])
  const [stampTypesLoading, setStampTypesLoading] = useState(false)
  const [stampTypesError, setStampTypesError] = useState('')
  const [errors, setErrors] = useState({})

  useEffect(() => {
    const preState = initialData?.state_code ?? 'KA'
    if (preState) handleStateChange(preState, true)
    if (initialData?.article_id) {
      fetchStampTypes(
        initialData.state_code ?? 'KA',
        String(initialData.article_id),
        initialData.consideration_amount ? String(initialData.consideration_amount) : '0',
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchStampTypes = useCallback(async (stateCode, articleId, considerationAmount) => {
    if (!stateCode || !articleId) { setStampValues([]); return }
    setStampTypesLoading(true)
    setStampTypesError('')
    setStampValues([])
    try {
      const res = await contractsApi.getStampTypes(stateCode, parseInt(articleId, 10), considerationAmount ? parseFloat(considerationAmount) : 0)
      const data = res.data
      const raw = Array.isArray(data?.data?.content) ? data.data.content : Array.isArray(data?.content) ? data.content : []
      const values = raw.flatMap((item) => {
        const d = item.denomination
        if (Array.isArray(d)) return d.filter((v) => typeof v === 'number')
        if (typeof d === 'number') return [d]
        return []
      })
      const sorted = [...new Set(values)].sort((a, b) => a - b)
      setStampValues(sorted)
      if (sorted.length > 0) setForm((f) => f.stamp_duty_amount ? f : { ...f, stamp_duty_amount: String(sorted[0]) })
    } catch {
      setStampTypesError('Failed to load stamp values')
    } finally {
      setStampTypesLoading(false)
    }
  }, [])

  const set = (key) => (e) => {
    const value = e.target.value
    setForm((f) => {
      const next = { ...f, [key]: value }
      if (key === 'article_id' || key === 'consideration_amount') {
        const articleId = key === 'article_id' ? value : f.article_id
        const consideration = key === 'consideration_amount' ? value : f.consideration_amount
        fetchStampTypes(next.state_code, articleId, consideration)
        if (key === 'article_id') next.stamp_duty_amount = ''
      }
      return next
    })
    setErrors((err) => ({ ...err, [key]: undefined }))
  }

  const handleStateChange = useCallback(async (stateCode, preserveArticle = false) => {
    setForm((f) => ({ ...f, state_code: stateCode, article_id: preserveArticle ? f.article_id : '' }))
    setErrors((err) => ({ ...err, state_code: undefined }))
    setArticles([])
    setArticlesError('')
    if (!stateCode) return
    setArticlesLoading(true)
    try {
      const res = await contractsApi.getArticles(stateCode)
      const data = res.data
      const list = Array.isArray(data?.data?.content) ? data.data.content
        : Array.isArray(data?.content) ? data.content
        : Array.isArray(data?.articles) ? data.articles
        : Array.isArray(data) ? data : []
      setArticles(list)
    } catch {
      setArticlesError('Failed to load articles')
    } finally {
      setArticlesLoading(false)
    }
  }, [])

  const validate = () => {
    const e = {}
    if (!form.first_party_name.trim()) e.first_party_name = 'Required'
    if (!form.second_party_name.trim()) e.second_party_name = 'Required'
    if (!form.stamp_duty_paid_by) e.stamp_duty_paid_by = 'Required'
    if (!form.description.trim()) e.description = 'Required'
    if (!form.state_code) e.state_code = 'Required'
    if (!form.article_id) e.article_id = 'Required'
    if (!form.stamp_duty_amount) e.stamp_duty_amount = 'Required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleAdd = () => {
    if (!validate()) return
    onAdd({
      first_party_name: form.first_party_name.trim(),
      second_party_name: form.second_party_name.trim(),
      stamp_duty_paid_by: form.stamp_duty_paid_by,
      description: form.description.trim(),
      article_id: parseInt(form.article_id, 10),
      consideration_amount: form.consideration_amount ? parseFloat(form.consideration_amount) : undefined,
      stamp_duty_amount: parseInt(form.stamp_duty_amount, 10),
      execution_date: Date.now(),
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <span className="bg-orange-500 text-white text-xs font-semibold px-3 py-1.5 rounded-full">1. eStamp Details</span>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>
        <div className="px-6 py-5 grid grid-cols-2 gap-4 max-h-[65vh] overflow-y-auto">
          {[
            { key: 'first_party_name', label: 'First Party Name', placeholder: 'Enter first party name', required: true },
            { key: 'second_party_name', label: 'Second Party Name', placeholder: 'Enter second party name', required: true },
          ].map(({ key, label, placeholder, required }) => (
            <div key={key}>
              <label className="text-xs font-medium text-gray-700 block mb-1">{label} {required && <span className="text-red-500">*</span>}</label>
              <input type="text" value={form[key]} onChange={set(key)} placeholder={placeholder} className={inputCls} />
              {errors[key] && <p className="text-red-500 text-[10px] mt-0.5">{errors[key]}</p>}
            </div>
          ))}
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Stamp Duty Paid By <span className="text-red-500">*</span></label>
            <select value={form.stamp_duty_paid_by} onChange={set('stamp_duty_paid_by')} className={selectCls}>
              <option value="">--select--</option>
              {STAMP_DUTY_PAID_BY.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {errors.stamp_duty_paid_by && <p className="text-red-500 text-[10px] mt-0.5">{errors.stamp_duty_paid_by}</p>}
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Purpose Of Stamp Duty <span className="text-red-500">*</span></label>
            <input type="text" value={form.description} onChange={set('description')} placeholder="Enter purpose here" className={inputCls} />
            {errors.description && <p className="text-red-500 text-[10px] mt-0.5">{errors.description}</p>}
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Select State <span className="text-red-500">*</span></label>
            <select value={form.state_code} onChange={(e) => handleStateChange(e.target.value)} className={selectCls}>
              <option value="">--select--</option>
              {INDIA_STATES.map((s) => <option key={s.code} value={s.code}>{s.label}</option>)}
            </select>
            {errors.state_code && <p className="text-red-500 text-[10px] mt-0.5">{errors.state_code}</p>}
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Article Number <span className="text-red-500">*</span></label>
            <div className="relative">
              <select value={form.article_id} onChange={set('article_id')} disabled={articlesLoading || !form.state_code} className={`${selectCls} disabled:opacity-50 disabled:cursor-not-allowed`}>
                <option value="">{articlesLoading ? 'Loading…' : articlesError ? 'Error loading' : '--select--'}</option>
                {articles.map((a) => <option key={a.id} value={String(a.id)}>{a.article_code} — {a.article_name}</option>)}
              </select>
              {articlesLoading && <Loader2 size={12} className="absolute right-8 top-1/2 -translate-y-1/2 animate-spin text-primary-500" />}
            </div>
            {articlesError && <p className="text-red-500 text-[10px] mt-0.5">Failed to load articles</p>}
            {errors.article_id && <p className="text-red-500 text-[10px] mt-0.5">{errors.article_id}</p>}
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Consideration Price</label>
            <input type="number" value={form.consideration_amount} onChange={set('consideration_amount')} placeholder="Enter price here" className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Stamp Duty Value <span className="text-red-500">*</span></label>
            <div className="relative">
              <select value={form.stamp_duty_amount} onChange={set('stamp_duty_amount')} disabled={stampTypesLoading || !form.article_id} className={`${selectCls} disabled:opacity-50 disabled:cursor-not-allowed`}>
                <option value="">{stampTypesLoading ? 'Loading…' : stampTypesError ? 'Error loading' : !form.article_id ? 'Select article first' : '--select--'}</option>
                {stampValues.map((v) => <option key={v} value={String(v)}>₹{v.toLocaleString()}</option>)}
              </select>
              {stampTypesLoading && <Loader2 size={12} className="absolute right-8 top-1/2 -translate-y-1/2 animate-spin text-primary-500" />}
            </div>
            {stampTypesError && <p className="text-red-500 text-[10px] mt-0.5">Failed to load stamp values</p>}
            {errors.stamp_duty_amount && <p className="text-red-500 text-[10px] mt-0.5">{errors.stamp_duty_amount}</p>}
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button type="button" onClick={onClose} className="text-sm font-medium text-gray-600 hover:text-gray-900 px-4 py-2">Cancel</button>
          <button type="button" onClick={handleAdd} className="bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold px-6 py-2 rounded-lg transition-colors">
            {initialData ? 'Save' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── eSignature Modal ─────────────────────────────────────────────────────────

function ESignatureModal({ onClose, onAdd, initialData, existingEmails = [], defaultName, defaultEmail, defaultContact }) {
  const [form, setForm] = useState({
    name: initialData?.name ?? defaultName ?? '',
    email: initialData?.email ?? defaultEmail ?? '',
    contact_number: initialData?.contact_number ?? defaultContact ?? '',
    method: initialData?.method ?? 'ELECTRONIC',
    sign_position: initialData?.sign_position ?? 'BOTTOM_LEFT',
    reminder: initialData?.reminder ? String(initialData.reminder) : '1',
    remark: initialData?.remark ?? '',
    send_document: initialData?.send_document ?? true,
  })
  const [errors, setErrors] = useState({})

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }))
    setErrors((err) => ({ ...err, [key]: undefined }))
  }

  const validate = () => {
    const e = {}
    if (!form.name.trim()) e.name = 'Required'
    if (!form.email.trim()) {
      e.email = 'Required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      e.email = 'Invalid email'
    } else if (existingEmails.includes(form.email.trim().toLowerCase())) {
      e.email = 'This email is already added as a signatory'
    }
    if (!form.method) e.method = 'Required'
    if (!form.sign_position) e.sign_position = 'Required'
    if (!form.reminder) e.reminder = 'Required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleAdd = () => {
    if (!validate()) return
    onAdd({
      name: form.name.trim(),
      email: form.email.trim(),
      contact_number: form.contact_number.trim(),
      method: form.method,
      sign_position: form.sign_position,
      reminder: parseInt(form.reminder, 10),
      remark: form.remark.trim(),
      send_document: form.send_document,
      pages: 'ALL',
      signatory_sequence: 0,
      send_notification: true,
      schedule_timestamp: '',
      esign_otp: false,
      server_side_siganture: false,
      cc_emails: [],
      sign_mode: '',
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <span className="bg-primary-500 text-white text-xs font-semibold px-3 py-1.5 rounded-full">1. eSignature Details</span>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>
        <div className="px-6 py-5 grid grid-cols-2 gap-4 max-h-[65vh] overflow-y-auto">
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Signatory Name <span className="text-red-500">*</span></label>
            <input type="text" value={form.name} onChange={set('name')} placeholder="Enter name here" className={inputCls} />
            {errors.name && <p className="text-red-500 text-[10px] mt-0.5">{errors.name}</p>}
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Signatory Email <span className="text-red-500">*</span></label>
            <input type="email" value={form.email} onChange={set('email')} placeholder="Enter mail here" className={inputCls} />
            {errors.email && <p className="text-red-500 text-[10px] mt-0.5">{errors.email}</p>}
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Signatory Mobile</label>
            <input type="text" value={form.contact_number} onChange={set('contact_number')} placeholder="Enter number here" className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Sign Method <span className="text-red-500">*</span></label>
            <select value={form.method} onChange={set('method')} className={selectCls}>
              {SIGN_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            {errors.method && <p className="text-red-500 text-[10px] mt-0.5">{errors.method}</p>}
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Signature Placement <span className="text-red-500">*</span></label>
            <select value={form.sign_position} onChange={set('sign_position')} className={selectCls}>
              {SIGN_POSITIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
            {errors.sign_position && <p className="text-red-500 text-[10px] mt-0.5">{errors.sign_position}</p>}
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Frequency of Reminders <span className="text-red-500">*</span></label>
            <select value={form.reminder} onChange={set('reminder')} className={selectCls}>
              {REMINDER_OPTIONS.map((r) => <option key={r.value} value={String(r.value)}>{r.label}</option>)}
            </select>
            {errors.reminder && <p className="text-red-500 text-[10px] mt-0.5">{errors.reminder}</p>}
          </div>
          <div className="col-span-2">
            <label className="text-xs font-medium text-gray-700 block mb-1">Remark</label>
            <input type="text" value={form.remark} onChange={set('remark')} placeholder="Enter remarks here" className={inputCls} />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-medium text-gray-700 block mb-2">Send Signed Document?</label>
            <div className="flex items-center gap-6">
              {[{ label: 'Yes', val: true }, { label: 'No', val: false }].map(({ label, val }) => (
                <label key={label} className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                  <input type="radio" name="sendSigned" checked={form.send_document === val} onChange={() => setForm((f) => ({ ...f, send_document: val }))} className="accent-primary-500" />
                  {label}
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button type="button" onClick={onClose} className="text-sm font-medium text-gray-600 hover:text-gray-900 px-4 py-2">Cancel</button>
          <button type="button" onClick={handleAdd} className="bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold px-6 py-2 rounded-lg transition-colors">
            {initialData ? 'Save' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Small dialogs ─────────────────────────────────────────────────────────────

function DeleteConfirmDialog({ label, onCancel, onConfirm }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs mx-4 overflow-hidden">
        <div className="px-6 py-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">Delete?</h3>
          <p className="text-xs text-gray-500">Remove <span className="font-medium text-gray-800">{label}</span>?</p>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button type="button" onClick={onCancel} className="text-sm font-medium text-gray-600 hover:text-gray-900 px-4 py-2">Cancel</button>
          <button type="button" onClick={onConfirm} className="bg-red-500 hover:bg-red-600 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors">Delete</button>
        </div>
      </div>
    </div>
  )
}

function ConfirmModal({ eStampCount, eSignCount, onCancel, onConfirm, submitting }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        <div className="px-6 py-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Send for Signature?</h3>
          <p className="text-xs text-gray-600">{eStampCount} eStamp(s) and {eSignCount} signatory(ies) will be submitted for processing.</p>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button type="button" onClick={onCancel} disabled={submitting} className="text-sm font-medium text-gray-600 hover:text-gray-900 px-4 py-2 disabled:opacity-50">Cancel</button>
          <button type="button" onClick={onConfirm} disabled={submitting} className="bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold px-6 py-2 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-70">
            {submitting && <Loader2 size={13} className="animate-spin" />}
            Confirm
          </button>
        </div>
      </div>
    </div>
  )
}

function ChatbotModal({ onClose, onGenerate, loading, error }) {
  const [desc, setDesc] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <span className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <MessageSquare size={15} className="text-primary-500" />
            Create Template from Chatbot
          </span>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>
        <div className="px-6 py-5">
          <label className="text-xs font-medium text-gray-700 block mb-2">Describe the document you need</label>
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="e.g. Employment agreement for a software engineer joining January 2025, including salary, designation, and 3-month probation period…"
            rows={4}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none resize-none"
          />
          <p className="text-[10px] text-gray-400 mt-1.5">AI will generate a professional template with blank fields for you to fill in.</p>
          {error && (
            <div className="flex items-start gap-2 mt-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">
              <AlertCircle size={13} className="shrink-0 mt-0.5" />
              {error}
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button type="button" onClick={onClose} disabled={loading} className="text-sm font-medium text-gray-600 hover:text-gray-900 px-4 py-2 disabled:opacity-50">Cancel</button>
          <button type="button" onClick={() => { if (desc.trim()) onGenerate(desc.trim()) }} disabled={loading || !desc.trim()} className="bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold px-6 py-2 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-70">
            {loading && <Loader2 size={13} className="animate-spin" />}
            Generate Template
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function SignaturesPage() {
  const [zoom, setZoom] = useState(100)
  const [activeTab, setActiveTab] = useState('eStamp')
  const [dragOver, setDragOver] = useState(false)
  const [applyPreview, setApplyPreview] = useState(false)
  const [customerName, setCustomerName] = useState(false)

  const [showEStampModal, setShowEStampModal] = useState(false)
  const [showESignModal, setShowESignModal] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [editEStampIndex, setEditEStampIndex] = useState(null)
  const [editESignIndex, setEditESignIndex] = useState(null)
  const [deleteEStampIndex, setDeleteEStampIndex] = useState(null)
  const [deleteESignIndex, setDeleteESignIndex] = useState(null)

  const [eStampList, setEStampList] = useState([])
  const [eSignList, setESignList] = useState([])

  const [submitting, setSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(null)
  const [submitError, setSubmitError] = useState(null)

  const [templateFields, setTemplateFields] = useState([])
  const [templateText, setTemplateText] = useState('')
  const [fieldValues, setFieldValues] = useState({})
  const [templateName, setTemplateName] = useState('')
  const [templateLoading, setTemplateLoading] = useState(false)
  const [templateError, setTemplateError] = useState('')
  const [uploadedFileUrl, setUploadedFileUrl] = useState(null)
  const [currentDocFile, setCurrentDocFile] = useState(null)
  const [showChatbotModal, setShowChatbotModal] = useState(false)
  const [chatbotLoading, setChatbotLoading] = useState(false)
  const [chatbotError, setChatbotError] = useState('')
  const [isTextMode, setIsTextMode] = useState(false)
  const [documentLoaded, setDocumentLoaded] = useState(false)
  const [rawInputValues, setRawInputValues] = useState({})
  const [fieldErrors, setFieldErrors] = useState({})
  const [templateHtml, setTemplateHtml] = useState('')
  const [fieldLabels, setFieldLabels] = useState({})   // fieldId → custom label
  const [editingLabelId, setEditingLabelId] = useState(null)

  const hasDocument = documentLoaded
  const hasTemplate = templateFields.length > 0

  const isDocxFile = (file) => {
    const docxMimes = [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'application/zip',
    ]
    const ext = file.name.toLowerCase().split('.').pop() ?? ''
    return docxMimes.includes(file.type) || ext === 'docx' || ext === 'doc'
  }

  const applyTemplateResult = useCallback((result, name, fileUrl, textMode = false, html = '') => {
    setTemplateFields(result.fields)
    setTemplateText(result.template_text)
    setTemplateHtml(html)
    setFieldValues({})
    setRawInputValues({})
    setFieldErrors({})
    setFieldLabels({})
    setEditingLabelId(null)
    setTemplateName(name)
    setIsTextMode(textMode)
    setDocumentLoaded(true)
    if (fileUrl) setUploadedFileUrl(fileUrl)
  }, [])

  const handleDocumentUpload = useCallback(async (file) => {
    setTemplateLoading(true)
    setTemplateError('')
    setDocumentLoaded(false)
    const docx = isDocxFile(file)
    try {
      if (docx) {
        const arrayBuffer = await file.arrayBuffer()
        const [mammothResult, res] = await Promise.all([
          mammoth.convertToHtml({ arrayBuffer }),
          templateApi.extractFields(file),
        ])
        const htmlWithMarkers = replaceBlanksInHtmlText(mammothResult.value, res.data.fields)
        setCurrentDocFile(file)
        applyTemplateResult(res.data, file.name, undefined, true, htmlWithMarkers)
      } else {
        // PDF / image: always use text mode so field values update live in the center
        const res = await templateApi.extractFields(file)
        setCurrentDocFile(file)
        applyTemplateResult(res.data, file.name, undefined, true)
      }
    } catch {
      setTemplateError('Could not extract fields. Please try again.')
    } finally {
      setTemplateLoading(false)
    }
  }, [applyTemplateResult])



  // Auto-fill date fields with today's date
  useEffect(() => {
    if (templateFields.length === 0) return
    const today = new Date()
    const yyyy = today.getFullYear()
    const mm = String(today.getMonth() + 1).padStart(2, '0')
    const dd = String(today.getDate()).padStart(2, '0')
    const todayIso = `${yyyy}-${mm}-${dd}`
    const todayDisplay = today.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    setRawInputValues((prev) => {
      const next = { ...prev }
      let changed = false
      templateFields.forEach((field) => {
        if (detectFieldType(field.label) === 'date' && !next[field.id]) { next[field.id] = todayIso; changed = true }
      })
      return changed ? next : prev
    })
    setFieldValues((prev) => {
      const next = { ...prev }
      let changed = false
      templateFields.forEach((field) => {
        if (detectFieldType(field.label) === 'date' && !next[field.id]) { next[field.id] = todayDisplay; changed = true }
      })
      return changed ? next : prev
    })
  }, [templateFields])

  const handleChatbotGenerate = async (description) => {
    setChatbotLoading(true)
    setChatbotError('')
    try {
      const res = await templateApi.generate(description)
      applyTemplateResult(res.data, 'AI Generated Template', undefined, true)
      setShowChatbotModal(false)
    } catch (err) {
      const msg = err?.response?.data?.detail ?? 'Failed to generate template. Please try again.'
      setChatbotError(typeof msg === 'string' ? msg : 'Failed to generate template. Please try again.')
    } finally {
      setChatbotLoading(false)
    }
  }

  const handleClearTemplate = () => {
    setTemplateFields([])
    setTemplateText('')
    setTemplateHtml('')
    setFieldValues({})
    setRawInputValues({})
    setFieldErrors({})
    setTemplateName('')
    setTemplateError('')
    setIsTextMode(false)
    setDocumentLoaded(false)
    setCurrentDocFile(null)
    if (uploadedFileUrl) { URL.revokeObjectURL(uploadedFileUrl); setUploadedFileUrl(null) }
  }

  const handleAddEStamp = (data) => {
    if (editEStampIndex !== null) {
      setEStampList((prev) => prev.map((item, i) => (i === editEStampIndex ? data : item)))
      setEditEStampIndex(null)
    } else {
      setEStampList((prev) => [...prev, data])
    }
    setShowEStampModal(false)
  }

  const handleAddESign = (data) => {
    if (editESignIndex !== null) {
      setESignList((prev) => prev.map((item, i) => (i === editESignIndex ? data : item)))
      setEditESignIndex(null)
    } else {
      setESignList((prev) => [...prev, data])
    }
    setShowESignModal(false)
  }

  const handleSendForSignature = () => {
    setSubmitSuccess(null)
    setSubmitError(null)
    if (eStampList.length === 0 && eSignList.length === 0) {
      setSubmitError('Please add eStamp or eSignature details to proceed.')
      return
    }
    setShowConfirmModal(true)
  }

  const handleConfirmSubmit = async () => {
    setSubmitting(true)
    try {
      let sendBlob
      let sendFileName

      if (isTextMode && templateText) {
        const resolvedText = templateText.replace(/{{(field_\d+)}}/g, (_, id) => fieldValues[id] ?? '')
        sendBlob = await templateApi.filledTextToPdf(resolvedText, templateName || 'document')
        sendFileName = `${templateName || 'document'}.pdf`
      } else if (currentDocFile) {
        sendBlob = currentDocFile
        sendFileName = currentDocFile.name
      } else {
        setSubmitError('Please upload a document before sending.')
        setSubmitting(false)
        return
      }

      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = reject
        reader.readAsDataURL(sendBlob)
      })

      await contractsApi.createOrderFromPdf({
        document: base64,
        file_name: sendFileName,
        is_bulk: false,
        order_details: [{
          branch_id: '3835',
          account_id: 1034,
          estamps: eStampList.length > 0 ? eStampList : undefined,
          esigns: eSignList.length > 0 ? { party_users: eSignList, witness_users: [] } : undefined,
        }],
      })

      setSubmitSuccess('Order submitted successfully!')
      setShowConfirmModal(false)
      setEStampList([])
      setESignList([])
    } catch (err) {
      const data = err?.response?.data?.detail
      let msg = 'Failed to submit order. Please try again.'
      if (typeof data === 'string') {
        msg = data
      } else if (data) {
        const errors = data?.content?.errors
        if (Array.isArray(errors) && errors.length > 0) msg = errors.join(' · ')
        else if (data?.content?.message) msg = data.content.message
        else if (data?.message) msg = data.message
      }
      setSubmitError(msg)
      setShowConfirmModal(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="h-full flex flex-col bg-surface-bg">
      {/* Sub-header */}
      <div className="flex items-center justify-between bg-white border border-surface-border rounded-xl px-4 py-2.5 mb-4 shadow-card">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-900">Template:</span>
          <span className="text-sm text-gray-700">Agreement</span>
          <ChevronDown size={14} className="text-gray-400" />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSendForSignature}
            className="flex items-center gap-1.5 bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold px-4 py-1.5 rounded-lg transition-colors"
          >
            <Settings size={14} />
            Send For Signature
          </button>
          <button type="button" aria-label="More options" className="p-1.5 rounded hover:bg-gray-100">
            <MoreHorizontal size={16} className="text-gray-500" />
          </button>
        </div>
      </div>

      {/* Status banners */}
      {submitSuccess && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-800 text-xs rounded-lg px-4 py-2.5 mb-4">
          <CheckCircle size={14} className="shrink-0" />
          {submitSuccess}
          <button type="button" onClick={() => setSubmitSuccess(null)} className="ml-auto"><X size={12} /></button>
        </div>
      )}
      {submitError && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-4 py-2.5 mb-4">
          <AlertCircle size={14} className="shrink-0" />
          {submitError}
          <button type="button" onClick={() => setSubmitError(null)} className="ml-auto"><X size={12} /></button>
        </div>
      )}

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Left sidebar */}
        <div className={`${hasDocument ? 'w-56' : 'w-44'} bg-white border border-surface-border rounded-xl shadow-card flex flex-col overflow-hidden shrink-0 transition-all duration-300`}>
          <div className="px-3 py-2.5 border-b border-surface-border flex items-center justify-between gap-1 min-w-0">
            {hasDocument ? (
              <>
                <div className="flex items-center gap-1.5 min-w-0">
                  <FileText size={12} className="text-primary-500 shrink-0" />
                  <span className="text-xs font-semibold text-gray-700 truncate">{templateName}</span>
                </div>
                <button type="button" onClick={handleClearTemplate} className="text-gray-400 hover:text-gray-600 shrink-0" title="Remove template">
                  <X size={12} />
                </button>
              </>
            ) : (
              <span className="text-xs font-semibold text-gray-400">No document</span>
            )}
          </div>

          {!hasDocument && (
            <div className="px-2 py-2 flex flex-col gap-1.5 border-b border-surface-border">
              <button type="button" onClick={() => setShowChatbotModal(true)} className="w-full flex items-center gap-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg px-2.5 py-1.5 hover:bg-gray-50 transition-colors font-medium">
                <MessageSquare size={11} />
                Generate via Chatbot
              </button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            {templateLoading ? (
              <div className="p-3 flex flex-col gap-2.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-2 bg-gray-200 rounded w-1/2 mb-1.5" />
                    <div className="h-7 bg-gray-100 rounded-lg w-full" />
                  </div>
                ))}
                <p className="text-[10px] text-gray-400 text-center mt-1">Extracting fields…</p>
              </div>
            ) : templateError ? (
              <div className="p-3">
                <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{templateError}</p>
              </div>
            ) : hasTemplate ? (
              <div className="p-3 flex flex-col gap-3">
                {(() => {
                  const groups = new Map()
                  templateFields.forEach((f) => {
                    const key = f.label.toLowerCase().trim()
                    if (!groups.has(key)) groups.set(key, [])
                    groups.get(key).push(f)
                  })
                  return Array.from(groups.values()).map((group) => {
                    const field = group[0]
                    const allIds = group.map((g) => g.id)
                    const raw = rawInputValues[field.id] ?? ''
                    const err = fieldErrors[field.id] ?? ''
                    const hasErr = !!err
                    const displayLabel = fieldLabels[field.id] ?? field.label
                    const isEditingThisLabel = editingLabelId === field.id

                    const commitLabel = (val) => {
                      const trimmed = val.trim()
                      if (trimmed && trimmed !== field.label) {
                        setFieldLabels((prev) => {
                          const next = { ...prev }
                          allIds.forEach((id) => { next[id] = trimmed })
                          return next
                        })
                      } else if (!trimmed) {
                        // revert to original if cleared
                        setFieldLabels((prev) => {
                          const next = { ...prev }
                          allIds.forEach((id) => { delete next[id] })
                          return next
                        })
                      }
                      setEditingLabelId(null)
                    }

                    return (
                      <div key={field.id}>
                        {/* Editable label */}
                        {isEditingThisLabel ? (
                          <input
                            autoFocus
                            defaultValue={displayLabel}
                            onBlur={(e) => commitLabel(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') commitLabel(e.target.value)
                              if (e.key === 'Escape') setEditingLabelId(null)
                            }}
                            className="text-[10px] font-semibold uppercase tracking-wide w-full mb-1 border-b border-primary-400 outline-none bg-transparent text-primary-600 placeholder:text-gray-300"
                          />
                        ) : (
                          <div
                            className="flex items-center gap-1 mb-1 group cursor-pointer"
                            onClick={() => setEditingLabelId(field.id)}
                            title="Click to rename this field"
                          >
                            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                              {displayLabel}
                            </span>
                            <Pencil size={8} className="text-gray-300 group-hover:text-primary-400 transition-colors shrink-0" />
                          </div>
                        )}
                        {detectFieldType(displayLabel) === 'date' ? (
                          <input
                            type="date"
                            value={raw}
                            onChange={(e) => {
                              const val = e.target.value
                              const display = val ? new Date(val + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : ''
                              setRawInputValues((r) => Object.assign({ ...r }, Object.fromEntries(allIds.map((id) => [id, val]))))
                              setFieldErrors((fe) => Object.assign({ ...fe }, Object.fromEntries(allIds.map((id) => [id, '']))))
                              setFieldValues((fv) => Object.assign({ ...fv }, Object.fromEntries(allIds.map((id) => [id, display]))))
                            }}
                            className={['w-full rounded-lg px-2.5 py-1.5 text-xs outline-none', hasErr ? 'border border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-400 bg-red-50' : 'border border-gray-200 focus:border-primary-500 focus:ring-1 focus:ring-primary-500'].join(' ')}
                          />
                        ) : (
                          <input
                            type="text"
                            value={raw}
                            onChange={(e) => {
                              const val = e.target.value
                              const error = validateFieldValue(displayLabel, val)
                              setRawInputValues((r) => Object.assign({ ...r }, Object.fromEntries(allIds.map((id) => [id, val]))))
                              setFieldErrors((fe) => Object.assign({ ...fe }, Object.fromEntries(allIds.map((id) => [id, error]))))
                              setFieldValues((fv) => Object.assign({ ...fv }, Object.fromEntries(allIds.map((id) => [id, error ? '' : val]))))
                            }}
                            placeholder={`Enter ${displayLabel.toLowerCase()}`}
                            className={['w-full rounded-lg px-2.5 py-1.5 text-xs outline-none placeholder:text-gray-300', hasErr ? 'border border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-400 bg-red-50' : 'border border-gray-200 focus:border-primary-500 focus:ring-1 focus:ring-primary-500'].join(' ')}
                          />
                        )}
                        {hasErr && (
                          <p className="text-[10px] text-red-500 mt-0.5 flex items-center gap-1">
                            <AlertCircle size={10} className="shrink-0" />
                            {err}
                          </p>
                        )}
                      </div>
                    )
                  })
                })()}
              </div>
            ) : null}
          </div>
        </div>

        {/* Center — document viewer */}
        <div className="flex-1 flex flex-col bg-gray-200 border border-surface-border rounded-xl overflow-hidden min-w-0">
          <div className="flex-1 overflow-hidden">
            {templateLoading ? (
              <div className="h-full overflow-y-auto bg-gray-200 py-8 px-6 flex justify-center">
                <div className="bg-white w-full animate-pulse" style={{ maxWidth: '794px', minHeight: '1123px', padding: '96px 96px', boxShadow: '0 1px 3px rgba(0,0,0,0.12)' }}>
                  <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto mb-8" />
                  {Array.from({ length: 18 }).map((_, i) => (
                    <div key={i} className="h-3 bg-gray-100 rounded mb-3" style={{ width: `${70 + (i % 4) * 8}%` }} />
                  ))}
                </div>
              </div>
            ) : isTextMode ? (
              <div className="h-full overflow-y-auto">
                <TemplatePreview templateText={templateText} templateHtml={templateHtml} fields={templateFields} values={fieldValues} />
              </div>
            ) : uploadedFileUrl ? (
              <iframe
                src={uploadedFileUrl}
                title="Document"
                className="w-full h-full border-0"
                style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top left', width: `${100 / (zoom / 100)}%`, height: `${100 / (zoom / 100)}%` }}
              />
            ) : (
              <label
                className={[
                  'h-full flex flex-col items-center justify-center cursor-pointer transition-all',
                  dragOver
                    ? 'bg-primary-50 border-2 border-primary-400 border-dashed rounded-xl'
                    : 'bg-gray-100',
                ].join(' ')}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragOver(false)
                  const file = e.dataTransfer.files?.[0]
                  if (file) handleDocumentUpload(file)
                }}
              >
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleDocumentUpload(f); e.target.value = '' }}
                />
                <div className="text-center px-8 py-12 max-w-sm">
                  <div className={[
                    'w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-5 transition-colors',
                    dragOver ? 'bg-primary-100' : 'bg-white shadow-sm',
                  ].join(' ')}>
                    <Upload size={36} className={dragOver ? 'text-primary-500' : 'text-gray-400'} />
                  </div>
                  <p className="text-base font-semibold text-gray-700 mb-1">
                    {dragOver ? 'Drop your file here' : 'Upload your document'}
                  </p>
                  <p className="text-sm text-gray-400 mb-5">
                    Drag &amp; drop or click to browse
                  </p>
                  <div className="flex items-center justify-center gap-3 mb-6">
                    {[['PDF', 'bg-red-50 text-red-600'], ['DOCX', 'bg-blue-50 text-blue-600'], ['DOC', 'bg-blue-50 text-blue-600']].map(([fmt, cls]) => (
                      <span key={fmt} className={`text-xs font-semibold px-3 py-1 rounded-full ${cls}`}>{fmt}</span>
                    ))}
                  </div>
                  <span className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition-colors shadow-sm">
                    <Upload size={15} />
                    Choose File
                  </span>
                  <p className="text-xs text-gray-400 mt-4">
                    Fields will be automatically extracted from your document
                  </p>
                </div>
              </label>
            )}
          </div>
          <div className="flex items-center justify-center gap-2 py-2 bg-white border-t border-surface-border shrink-0">
            <button type="button" onClick={() => setZoom((z) => Math.max(50, z - 10))} className="p-1.5 rounded hover:bg-gray-100">
              <ZoomOut size={14} className="text-gray-500" />
            </button>
            <span className="text-xs text-gray-600 w-12 text-center">{zoom}%</span>
            <button type="button" onClick={() => setZoom((z) => Math.min(150, z + 10))} className="p-1.5 rounded hover:bg-gray-100">
              <ZoomIn size={14} className="text-gray-500" />
            </button>
          </div>
        </div>

        {/* Right panel — eStamp / eSignature */}
        <div className="w-64 bg-white border border-surface-border rounded-xl shadow-card flex flex-col overflow-hidden shrink-0">
          <div className="flex border-b border-surface-border">
            {['eStamp', 'eSignature'].map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={['flex-1 py-2.5 text-xs font-semibold transition-colors', activeTab === tab ? 'text-primary-500 border-b-2 border-primary-500' : 'text-gray-500 hover:text-gray-700'].join(' ')}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {activeTab === 'eStamp' ? (
              <div className="flex flex-col gap-3">
                {eStampList.map((stamp, i) => (
                  <div key={i} className="border border-gray-100 rounded-xl p-3 bg-gray-50 flex flex-col gap-2">
                    <label className="flex items-center gap-2 text-[10px] text-gray-600 cursor-pointer pb-1.5 border-b border-gray-100">
                      <input type="checkbox" checked={applyPreview} onChange={(e) => setApplyPreview(e.target.checked)} className="rounded border-gray-300 accent-primary-500" />
                      Apply eStamp
                    </label>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">First Party</span>
                      <span className="text-gray-800 font-medium truncate max-w-[110px]">{stamp.first_party_name}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">Stamp Value</span>
                      <span className="text-gray-800 font-medium">₹{stamp.stamp_duty_amount.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">Article</span>
                      <span className="text-gray-800 font-medium">#{stamp.article_id}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <button type="button" onClick={() => setDeleteEStampIndex(i)} className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors"><Trash2 size={12} /></button>
                      <button type="button" onClick={() => { setEditEStampIndex(i); setShowEStampModal(true) }} className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors"><Pencil size={12} /></button>
                    </div>
                  </div>
                ))}
                <div className="flex flex-col items-center gap-1">
                  <button type="button" onClick={() => setShowEStampModal(true)} className="w-full flex items-center justify-center gap-1.5 border-2 border-dashed border-primary-300 text-primary-500 rounded-lg py-2 text-xs font-semibold hover:bg-primary-50 transition-colors">
                    <Plus size={13} />
                    Add eStamp
                  </button>
                  <span className="text-[15px] text-gray-400">Optional</span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={customerName} onChange={(e) => setCustomerName(e.target.checked)} className="rounded border-gray-300 accent-primary-500" />
                  Customer Name
                </label>
                {eSignList.map((sign, i) => (
                  <div key={i} className="border border-gray-100 rounded-xl p-3 bg-gray-50 flex flex-col gap-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">Name</span>
                      <span className="text-gray-800 font-medium truncate max-w-[110px]">{sign.name}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">Email</span>
                      <span className="text-gray-800 font-medium truncate max-w-[110px]">{sign.email}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">Method</span>
                      <span className="text-gray-800 font-medium">{sign.method}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">Position</span>
                      <span className="text-gray-800 font-medium">{sign.sign_position.replace(/_/g, ' ')}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <button type="button" onClick={() => setDeleteESignIndex(i)} className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors"><Trash2 size={12} /></button>
                      <button type="button" onClick={() => { setEditESignIndex(i); setShowESignModal(true) }} className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors"><Pencil size={12} /></button>
                    </div>
                  </div>
                ))}
                <button type="button" onClick={() => setShowESignModal(true)} className="w-full flex items-center justify-center gap-1.5 border-2 border-dashed border-primary-300 text-primary-500 rounded-lg py-2 text-xs font-semibold hover:bg-primary-50 transition-colors">
                  <Plus size={13} />
                  Add Signature
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {showChatbotModal && (
        <ChatbotModal onClose={() => { setShowChatbotModal(false); setChatbotError('') }} onGenerate={handleChatbotGenerate} loading={chatbotLoading} error={chatbotError} />
      )}
      {showEStampModal && (
        <EStampModal
          onClose={() => { setShowEStampModal(false); setEditEStampIndex(null) }}
          onAdd={handleAddEStamp}
          initialData={editEStampIndex !== null ? eStampList[editEStampIndex] : undefined}
          defaultFirstParty={editEStampIndex === null ? undefined : undefined}
        />
      )}
      {showESignModal && (
        <ESignatureModal
          onClose={() => { setShowESignModal(false); setEditESignIndex(null) }}
          onAdd={handleAddESign}
          initialData={editESignIndex !== null ? eSignList[editESignIndex] : undefined}
          existingEmails={eSignList.filter((_, i) => i !== editESignIndex).map((s) => s.email.toLowerCase())}
        />
      )}
      {showConfirmModal && (
        <ConfirmModal eStampCount={eStampList.length} eSignCount={eSignList.length} onCancel={() => setShowConfirmModal(false)} onConfirm={handleConfirmSubmit} submitting={submitting} />
      )}
      {deleteEStampIndex !== null && (
        <DeleteConfirmDialog label={eStampList[deleteEStampIndex]?.first_party_name ?? 'this eStamp'} onCancel={() => setDeleteEStampIndex(null)} onConfirm={() => { setEStampList((prev) => prev.filter((_, i) => i !== deleteEStampIndex)); setDeleteEStampIndex(null) }} />
      )}
      {deleteESignIndex !== null && (
        <DeleteConfirmDialog label={eSignList[deleteESignIndex]?.name ?? 'this signatory'} onCancel={() => setDeleteESignIndex(null)} onConfirm={() => { setESignList((prev) => prev.filter((_, i) => i !== deleteESignIndex)); setDeleteESignIndex(null) }} />
      )}
    </div>
  )
}
