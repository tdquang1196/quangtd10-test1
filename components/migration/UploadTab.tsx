import { Card, CardContent, Input } from '@/components/ui'

interface UploadTabProps {
  file: File | null
  schoolPrefix: string
  errors: Array<{ row: number; message: string }>
  setSchoolPrefix: (prefix: string) => void
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export default function UploadTab({
  file,
  schoolPrefix,
  errors,
  setSchoolPrefix,
  handleFileChange
}: UploadTabProps) {
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
                    {file ? file.name : 'Click to upload Excel file'}
                  </p>
                  <p className="text-xs text-gray-500">
                    Supports .xlsx and .xls files
                  </p>
                </div>
              </label>
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
