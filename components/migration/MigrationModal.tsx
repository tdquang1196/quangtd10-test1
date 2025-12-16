'use client'

import { useMigration } from '@/hooks/useMigration'
import { Button, Card, CardHeader, CardTitle, CardContent, Input, Badge } from '@/components/ui'
import Notification from '@/components/Notification'
import UploadTab from './UploadTab'
import BatchUploadTab from './BatchUploadTab'
import BatchPreviewTab from './BatchPreviewTab'
import PreviewTab from './PreviewTab'
import ResultsTab from './ResultsTab'
import BatchResultsTab from './BatchResultsTab'
import { MigrationModalProps } from '@/types'
import { useState } from 'react'

export default function MigrationModal({ isOpen, onClose }: MigrationModalProps) {
  const migration = useMigration()
  const [mode, setMode] = useState<'single' | 'batch'>('single')

  if (!isOpen) return null

  const handleClose = () => {
    migration.resetState()
    setMode('single')
    onClose()
  }

  const tabs = mode === 'single'
    ? [
      { id: 'upload' as const, label: 'Upload File', icon: '📤' },
      { id: 'preview' as const, label: 'Preview', icon: '👁', count: migration.students.length + migration.teachers.length, disabled: migration.students.length === 0 },
      { id: 'results' as const, label: 'Results', icon: '✅', disabled: migration.createdUsers.length === 0 && migration.failedUsers.length === 0 },
    ]
    : [
      { id: 'batch-upload' as const, label: 'Upload Files', icon: '📦' },
      { id: 'batch-preview' as const, label: 'Preview', icon: '👁', disabled: migration.batchPreviewData.length === 0 },
      { id: 'batch-results' as const, label: 'Results', icon: '✅', disabled: migration.batchResults.length === 0 },
    ]

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-8 py-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Bulk User Migration</h2>
                <p className="text-sm text-gray-600">Import students and teachers from Excel</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Mode Switcher */}
              <div className="flex bg-white rounded-lg p-1 border border-gray-200">
                <button
                  onClick={() => setMode('single')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${mode === 'single'
                    ? 'bg-blue-500 text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                    }`}
                >
                  📄 Single School
                </button>
                <button
                  onClick={() => setMode('batch')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${mode === 'batch'
                    ? 'bg-blue-500 text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                    }`}
                >
                  📦 Multi School
                </button>
              </div>
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-lg"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 px-8 bg-gray-50/50">
          <div className="flex gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => !tab.disabled && migration.setActiveTab(tab.id)}
                disabled={tab.disabled}
                className={`px-6 py-4 font-semibold transition-all relative flex items-center gap-2 ${migration.activeTab === tab.id
                  ? 'text-blue-600 bg-white rounded-t-xl shadow-sm'
                  : tab.disabled
                    ? 'text-gray-400 cursor-not-allowed'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                  }`}
              >
                <span className="text-lg">{tab.icon}</span>
                <span>{tab.label}</span>
                {'count' in tab && tab.count !== undefined && tab.count > 0 && (
                  <Badge variant="info" size="sm">{tab.count}</Badge>
                )}
                {migration.activeTab === tab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-t-full" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-8 bg-gray-50/30">
          {mode === 'single' ? (
            <>
              {migration.activeTab === 'upload' && (
                <UploadTab
                  file={migration.file}
                  schoolPrefix={migration.schoolPrefix}
                  errors={migration.errors}
                  enableAutoSubscription={migration.enableAutoSubscription}
                  subscriptionId={migration.subscriptionId}
                  subscriptionDescription={migration.subscriptionDescription}
                  subscriptionRequester={migration.subscriptionRequester}
                  subscriptionSource={migration.subscriptionSource}
                  excelConfig={migration.excelConfig}
                  setSchoolPrefix={migration.setSchoolPrefix}
                  setEnableAutoSubscription={migration.setEnableAutoSubscription}
                  setSubscriptionId={migration.setSubscriptionId}
                  setSubscriptionDescription={migration.setSubscriptionDescription}
                  setSubscriptionRequester={migration.setSubscriptionRequester}
                  setSubscriptionSource={migration.setSubscriptionSource}
                  setExcelConfig={migration.setExcelConfig}
                  handleFileChange={migration.handleFileChange}
                  onClearFile={migration.clearFile}
                />
              )}
              {migration.activeTab === 'preview' && <PreviewTab {...migration} />}
              {migration.activeTab === 'results' && (
                <ResultsTab
                  result={migration.result}
                  createdUsers={migration.createdUsers}
                  failedUsers={migration.failedUsers}
                  showNotification={migration.showNotification}
                  isAssigningPackages={migration.isAssigningPackages}
                  packageAssignmentProgress={migration.packageAssignmentProgress}
                  packageAssignmentResult={migration.packageAssignmentResult}
                  retryFailedPackages={migration.retryFailedPackages}
                  retryFailedUsers={migration.retryFailedUsers}
                  retryRoleAssignment={migration.retryRoleAssignment}
                  isRetrying={migration.isCreating}
                />
              )}
            </>
          ) : (
            <>
              {migration.activeTab === 'batch-upload' && (
                <BatchUploadTab
                  onSubmit={migration.handleProcessBatch}
                  isProcessing={migration.isProcessing}
                  schools={migration.batchSchoolsForm}
                  setSchools={migration.setBatchSchoolsForm}
                  subscriptionConfig={migration.batchFormSubscriptionConfig}
                  setSubscriptionConfig={migration.setBatchFormSubscriptionConfig}
                />
              )}
              {migration.activeTab === 'batch-preview' && (
                <BatchPreviewTab
                  schools={migration.batchPreviewData}
                  onBack={() => migration.setActiveTab('batch-upload')}
                  onCreate={migration.handleCreateBatch}
                  isCreating={migration.isBatchProcessing}
                />
              )}
              {migration.activeTab === 'batch-results' && (
                <BatchResultsTab
                  results={migration.batchResults}
                  onClose={handleClose}
                  retryBatchSchoolPackages={migration.retryBatchSchoolPackages}
                  retryBatchSchoolFailedUsers={migration.retryBatchSchoolFailedUsers}
                  retryingSchoolIndex={migration.retryingSchoolIndex}
                />
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 py-5 border-t border-gray-200 bg-white flex justify-between items-center">
          <div className="text-sm text-gray-500">
            {migration.activeTab === 'upload' && 'Step 1 of 3: Upload your Excel file'}
            {migration.activeTab === 'preview' && 'Step 2 of 3: Review and confirm data'}
            {migration.activeTab === 'results' && 'Step 3 of 3: Migration complete'}
          </div>
          <div className="flex gap-3">
            {migration.activeTab === 'upload' && (
              <>
                <Button variant="secondary" onClick={handleClose}>
                  Cancel
                </Button>
                <Button
                  onClick={migration.handleProcessFile}
                  loading={migration.isProcessing}
                  disabled={!migration.file || !migration.schoolPrefix}
                >
                  Process File
                </Button>
              </>
            )}
            {migration.activeTab === 'preview' && (
              <>
                <Button variant="secondary" onClick={() => migration.setActiveTab('upload')}>
                  Back to Upload
                </Button>
                <Button
                  onClick={migration.handleCreateUsers}
                  loading={migration.isCreating}
                  disabled={migration.students.length === 0 && migration.teachers.length === 0}
                >
                  Create {migration.students.length + migration.teachers.length} Users
                </Button>
              </>
            )}
            {migration.activeTab === 'results' && (
              <Button onClick={handleClose}>
                Close
              </Button>
            )}
          </div>
        </div>
      </div>

      {migration.notification && (
        <Notification
          message={migration.notification.message}
          type={migration.notification.type}
          onClose={() => migration.setNotification(null)}
        />
      )}
    </div>
  )
}
