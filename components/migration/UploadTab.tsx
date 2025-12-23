import { Card, CardContent, Input } from '@/components/ui'
import { useState, useEffect } from 'react'
import { getSubscriptions } from '@/lib/api/users'
import { PACKAGE_SOURCE_OPTIONS } from '@/constants/package-source'

interface UploadTabProps {
  file: File | null
  schoolPrefix: string
  errors: Array<{ row: number; message: string }>
  enableAutoSubscription: boolean
  subscriptionId: string
  subscriptionDescription: string
  subscriptionRequester: string
  subscriptionSource: string
  excelConfig: {
    startRow: number
    fullNameColumn: string
    gradeColumn: string
    phoneNumberColumn: string
    birthDateColumn: string
    usernameColumn: string
    readAllSheets: boolean
    excludeLastSheet: boolean
  }
  setSchoolPrefix: (prefix: string) => void
  setEnableAutoSubscription: (enable: boolean) => void
  setSubscriptionId: (id: string) => void
  setSubscriptionDescription: (desc: string) => void
  setSubscriptionRequester: (requester: string) => void
  setSubscriptionSource: (source: string) => void
  setExcelConfig: (config: {
    startRow: number
    fullNameColumn: string
    gradeColumn: string
    phoneNumberColumn: string
    birthDateColumn: string
    usernameColumn: string
    readAllSheets: boolean
    excludeLastSheet: boolean
  }) => void
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onClearFile?: () => void
}

export default function UploadTab({
  file,
  schoolPrefix,
  errors,
  enableAutoSubscription,
  subscriptionId,
  subscriptionDescription,
  subscriptionRequester,
  subscriptionSource,
  excelConfig,
  setSchoolPrefix,
  setEnableAutoSubscription,
  setSubscriptionId,
  setSubscriptionDescription,
  setSubscriptionRequester,
  setSubscriptionSource,
  setExcelConfig,
  handleFileChange,
  onClearFile
}: UploadTabProps) {
  const [subscriptions, setSubscriptions] = useState<Array<{ id: string; title: string }>>([])
  const [isLoadingSubscriptions, setIsLoadingSubscriptions] = useState(false)

  // Fetch subscriptions on mount
  useEffect(() => {
    const fetchSubscriptions = async () => {
      setIsLoadingSubscriptions(true)
      try {
        const response = await getSubscriptions()
        if (response?.data?.subcriptions) {
          setSubscriptions(
            response.data.subcriptions.map((sub: any) => ({
              id: sub.id,
              title: sub.title
            }))
          )
        }
      } catch (error) {
        console.error('Failed to fetch subscriptions:', error)
      } finally {
        setIsLoadingSubscriptions(false)
      }
    }

    fetchSubscriptions()
  }, [])

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Instructions */}
      <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200">
        <CardContent className="p-6">
          <div className="flex gap-4">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-gray-900 mb-3 text-lg">Excel File Format</h3>
              <ul className="space-y-2 text-sm text-gray-700">
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span><strong>Column 1:</strong> Full name (Vietnamese text supported)</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span><strong>Column 2:</strong> Grade (e.g., 1A, 1B, 2C, etc.)</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span><strong>Column 3:</strong> Phone number</span>
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Form */}
      <Card>
        <CardContent className="p-6 space-y-5">
          <Input
            label="School Code (Prefix) *"
            placeholder="e.g., hytkltt"
            value={schoolPrefix}
            onChange={(e) => setSchoolPrefix(e.target.value)}
            helperText="This prefix will be used to generate unique usernames"
          />

          {/* Excel Configuration */}
          <Card className="border-2 border-blue-200 overflow-hidden">
            <div className="p-4 bg-blue-50 border-b border-blue-200">
              <h3 className="text-sm font-semibold text-blue-900 mb-1">Excel File Configuration</h3>
              <p className="text-xs text-blue-700">Configure how to read your Excel file</p>
            </div>
            <div className="p-4 bg-white space-y-4">
              {/* Row Configuration */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">
                    Start Row <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={excelConfig.startRow}
                    onChange={(e) => setExcelConfig({ ...excelConfig, startRow: parseInt(e.target.value) || 1 })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:border-gray-900 focus:ring-1 focus:ring-gray-900 outline-none"
                    placeholder="2"
                  />
                  <p className="text-xs text-gray-500 mt-1">Row where data starts (usually 2 to skip header)</p>
                </div>

                <div className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg">
                  <input
                    type="checkbox"
                    id="read-all-sheets"
                    checked={excelConfig.readAllSheets}
                    onChange={(e) => setExcelConfig({ ...excelConfig, readAllSheets: e.target.checked })}
                    className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                  />
                  <label htmlFor="read-all-sheets" className="flex-1 cursor-pointer">
                    <div className="text-sm font-semibold text-gray-900">Read All Sheets</div>
                    <div className="text-xs text-gray-600">Process data from all sheets in the file</div>
                  </label>
                </div>

                <div className="flex items-center gap-3 p-3 border border-orange-200 rounded-lg bg-orange-50">
                  <input
                    type="checkbox"
                    id="exclude-last-sheet"
                    checked={excelConfig.excludeLastSheet}
                    onChange={(e) => setExcelConfig({ ...excelConfig, excludeLastSheet: e.target.checked })}
                    className="w-5 h-5 text-orange-600 border-gray-300 rounded focus:ring-orange-500 cursor-pointer"
                  />
                  <label htmlFor="exclude-last-sheet" className="flex-1 cursor-pointer">
                    <div className="text-sm font-semibold text-orange-900">Exclude Last Sheet</div>
                    <div className="text-xs text-orange-700">Skip the last sheet (often teacher info)</div>
                  </label>
                </div>
              </div>

              {/* Column Mapping */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">
                    Full Name Column <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={excelConfig.fullNameColumn}
                    onChange={(e) => setExcelConfig({ ...excelConfig, fullNameColumn: e.target.value.toUpperCase() })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:border-gray-900 focus:ring-1 focus:ring-gray-900 outline-none uppercase"
                    placeholder="A"
                    maxLength={3}
                  />
                  <p className="text-xs text-gray-500 mt-1">Column letter (e.g., A, B, AA)</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">
                    Grade Column <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={excelConfig.gradeColumn}
                    onChange={(e) => setExcelConfig({ ...excelConfig, gradeColumn: e.target.value.toUpperCase() })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:border-gray-900 focus:ring-1 focus:ring-gray-900 outline-none uppercase"
                    placeholder="B"
                    maxLength={3}
                  />
                  <p className="text-xs text-gray-500 mt-1">Column letter (e.g., A, B, AA)</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">
                    Phone Number Column
                  </label>
                  <input
                    type="text"
                    value={excelConfig.phoneNumberColumn}
                    onChange={(e) => setExcelConfig({ ...excelConfig, phoneNumberColumn: e.target.value.toUpperCase() })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:border-gray-900 focus:ring-1 focus:ring-gray-900 outline-none uppercase"
                    placeholder="C"
                    maxLength={3}
                  />
                  <p className="text-xs text-gray-500 mt-1">Column letter (optional)</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">
                    🎂 Birth Date Column
                  </label>
                  <input
                    type="text"
                    value={excelConfig.birthDateColumn}
                    onChange={(e) => setExcelConfig({ ...excelConfig, birthDateColumn: e.target.value.toUpperCase() })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:border-gray-900 focus:ring-1 focus:ring-gray-900 outline-none uppercase"
                    placeholder="D"
                    maxLength={3}
                  />
                  <p className="text-xs text-gray-500 mt-1">For age calculation (optional)</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">
                    Username Column
                  </label>
                  <input
                    type="text"
                    value={excelConfig.usernameColumn}
                    onChange={(e) => setExcelConfig({ ...excelConfig, usernameColumn: e.target.value.toUpperCase() })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:border-gray-900 focus:ring-1 focus:ring-gray-900 outline-none uppercase"
                    placeholder=""
                    maxLength={3}
                  />
                  <p className="text-xs text-gray-500 mt-1">Skip if has value (optional)</p>
                </div>
              </div>

              {/* Preview Example */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <div className="text-xs font-semibold text-gray-700 mb-2">Preview:</div>
                <div className="text-xs text-gray-600 font-mono">
                  Row {excelConfig.startRow}: {excelConfig.fullNameColumn}="Nguyen Van A", {excelConfig.gradeColumn}="10A", {excelConfig.phoneNumberColumn}="0123456789"
                  {excelConfig.usernameColumn && <span className="text-orange-600"> | {excelConfig.usernameColumn}=username → SKIP</span>}
                </div>
              </div>
            </div>
          </Card>

          {/* Auto Subscription Assignment */}
          <div className="border-2 border-green-200 rounded-lg overflow-hidden">
            <div className="flex items-start gap-3 p-4 bg-green-50">
              <input
                type="checkbox"
                id="auto-subscription-checkbox"
                checked={enableAutoSubscription}
                onChange={(e) => setEnableAutoSubscription(e.target.checked)}
                className="mt-1 w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500 cursor-pointer"
              />
              <label htmlFor="auto-subscription-checkbox" className="flex-1 cursor-pointer">
                <div className="text-sm font-semibold text-green-900 mb-1">
                  Auto-Assign Subscription Packages
                </div>
                <div className="text-xs text-green-700">
                  Automatically assign subscription packages to students after migration completes
                </div>
              </label>
            </div>

            {/* Subscription Details (shown when enabled) */}
            {enableAutoSubscription && (
              <div className="p-4 bg-white space-y-4 border-t border-green-200">
                {/* Subscription Package */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">
                    Subscription Package <span className="text-red-600">*</span>
                  </label>
                  {isLoadingSubscriptions ? (
                    <div className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 text-sm">
                      Loading subscriptions...
                    </div>
                  ) : subscriptions.length === 0 ? (
                    <div className="w-full px-4 py-3 border border-red-200 rounded-lg bg-red-50 text-red-600 text-sm">
                      No subscriptions available
                    </div>
                  ) : (
                    <select
                      value={subscriptionId}
                      onChange={(e) => setSubscriptionId(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:border-gray-900 focus:ring-1 focus:ring-gray-900 outline-none bg-white"
                    >
                      <option value="">Select a subscription package</option>
                      {subscriptions.map(sub => (
                        <option key={sub.id} value={sub.id}>{sub.title}</option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    value={subscriptionDescription}
                    onChange={(e) => setSubscriptionDescription(e.target.value)}
                    placeholder="e.g., Migration batch 2025-12-09"
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:border-gray-900 focus:ring-1 focus:ring-gray-900 outline-none"
                  />
                </div>

                {/* Requester */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">
                    Requester
                  </label>
                  <input
                    type="text"
                    value={subscriptionRequester}
                    onChange={(e) => setSubscriptionRequester(e.target.value)}
                    placeholder="Your name"
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:border-gray-900 focus:ring-1 focus:ring-gray-900 outline-none"
                  />
                </div>

                {/* Source */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">
                    Package Source <span className="text-red-600">*</span>
                  </label>
                  <select
                    value={subscriptionSource}
                    onChange={(e) => setSubscriptionSource(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:border-gray-900 focus:ring-1 focus:ring-gray-900 outline-none bg-white"
                  >
                    {PACKAGE_SOURCE_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block mb-2 text-sm font-semibold text-gray-700">
              Excel File *
            </label>
            <div className="relative">
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
              />
              {file ? (
                <div className="flex items-center gap-3 w-full px-6 py-4 border-2 border-green-300 bg-green-50 rounded-xl">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-green-800 truncate">{file.name}</p>
                    <p className="text-xs text-green-600">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <div className="flex gap-2">
                    <label
                      htmlFor="file-upload"
                      className="px-3 py-2 text-xs font-medium text-blue-700 bg-blue-100 rounded-lg hover:bg-blue-200 cursor-pointer transition-colors"
                    >
                      Change
                    </label>
                    {onClearFile && (
                      <button
                        type="button"
                        onClick={onClearFile}
                        className="px-3 py-2 text-xs font-medium text-red-700 bg-red-100 rounded-lg hover:bg-red-200 transition-colors"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <label
                  htmlFor="file-upload"
                  className="flex items-center justify-center w-full px-6 py-8 border-2 border-dashed border-gray-300 rounded-xl hover:border-blue-500 hover:bg-blue-50/50 transition-all cursor-pointer group"
                >
                  <div className="text-center">
                    <div className="w-16 h-16 bg-gray-100 group-hover:bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 transition-colors">
                      <svg className="w-8 h-8 text-gray-400 group-hover:text-blue-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                    </div>
                    <p className="text-sm font-semibold text-gray-700 mb-1">
                      Click to upload Excel file
                    </p>
                    <p className="text-xs text-gray-500">
                      Supports .xlsx and .xls files
                    </p>
                  </div>
                </label>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Errors */}
      {errors.length > 0 && (
        <Card className="border-2 border-red-200 bg-red-50">
          <CardContent className="p-6">
            <div className="flex gap-3">
              <div className="flex-shrink-0">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-red-900 mb-3">Parsing Errors</h4>
                <div className="space-y-2 max-h-40 overflow-auto">
                  {errors.map((err, idx) => (
                    <p key={idx} className="text-sm text-red-800 bg-white/50 px-3 py-2 rounded-lg">
                      <strong>Row {err.row}:</strong> {err.message}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
