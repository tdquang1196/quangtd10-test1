'use client'

import { useState } from 'react'
import Link from 'next/link'
import DeleteAccountModal from '@/components/DeleteAccountModal'
import { Button } from '@/components/ui'
import { ProtectedRoute } from '@/components/ProtectedRoute'

export default function DeleteAccountPage() {
    const [isModalOpen, setIsModalOpen] = useState(false)

    return (
        <ProtectedRoute>
            <div className="min-h-screen p-4 md:p-8 max-w-4xl mx-auto">
                {/* Breadcrumb */}
                <Link
                    href="/"
                    className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-8"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    Back
                </Link>

                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
                        Delete Account
                    </h1>
                    <p className="text-gray-600">
                        Bulk delete user accounts from Excel file
                    </p>
                </div>

                {/* Warning Banner */}
                <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-6 mb-8">
                    <div className="flex items-start gap-3">
                        <svg className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <div>
                            <h3 className="font-semibold text-red-900 mb-1">⚠️ Cảnh báo quan trọng</h3>
                            <p className="text-sm text-red-800">
                                Tính năng này sẽ <strong>XÓA VĨNH VIỄN</strong> các tài khoản. Hành động này <strong>KHÔNG THỂ KHÔI PHỤC</strong>.
                                Vui lòng kiểm tra kỹ danh sách trước khi thực hiện.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Steps */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                    <div className="bg-white rounded-lg border border-gray-200 p-4">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-6 h-6 rounded-full bg-red-600 text-white flex items-center justify-center text-sm font-semibold">
                                1
                            </div>
                            <h3 className="font-semibold">Upload</h3>
                        </div>
                        <p className="text-sm text-gray-600">Upload Excel file</p>
                    </div>

                    <div className="bg-white rounded-lg border border-gray-200 p-4">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-6 h-6 rounded-full bg-red-600 text-white flex items-center justify-center text-sm font-semibold">
                                2
                            </div>
                            <h3 className="font-semibold">Preview</h3>
                        </div>
                        <p className="text-sm text-gray-600">Review account list</p>
                    </div>

                    <div className="bg-white rounded-lg border border-gray-200 p-4">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-6 h-6 rounded-full bg-red-600 text-white flex items-center justify-center text-sm font-semibold">
                                3
                            </div>
                            <h3 className="font-semibold">Delete</h3>
                        </div>
                        <p className="text-sm text-gray-600">Execute deletion</p>
                    </div>

                    <div className="bg-white rounded-lg border border-gray-200 p-4">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-6 h-6 rounded-full bg-red-600 text-white flex items-center justify-center text-sm font-semibold">
                                4
                            </div>
                            <h3 className="font-semibold">Results</h3>
                        </div>
                        <p className="text-sm text-gray-600">View deletion results</p>
                    </div>
                </div>

                {/* How it works */}
                <div className="bg-gray-50 rounded-lg border border-gray-200 p-6 mb-8">
                    <h2 className="font-semibold mb-4">How it works</h2>
                    <ol className="space-y-3 text-sm text-gray-600">
                        <li className="flex items-start gap-3">
                            <span className="font-semibold text-gray-900 min-w-[24px]">1.</span>
                            <span>Import Excel file với 2 cột: <strong>username</strong> và <strong>password</strong></span>
                        </li>
                        <li className="flex items-start gap-3">
                            <span className="font-semibold text-gray-900 min-w-[24px]">2.</span>
                            <span>Hệ thống sẽ login vào từng account bằng username/password</span>
                        </li>
                        <li className="flex items-start gap-3">
                            <span className="font-semibold text-gray-900 min-w-[24px]">3.</span>
                            <span>Sau khi login, gọi API <code className="bg-gray-200 px-1 rounded">POST /api/account/users/delete</code> với body: <code className="bg-gray-200 px-1 rounded">{`{"password": "..."}`}</code></span>
                        </li>
                        <li className="flex items-start gap-3">
                            <span className="font-semibold text-gray-900 min-w-[24px]">4.</span>
                            <span>Xem kết quả thành công/thất bại cho từng account</span>
                        </li>
                    </ol>
                </div>

                {/* Excel Format */}
                <div className="bg-gray-50 rounded-lg border border-gray-200 p-6 mb-8">
                    <h2 className="font-semibold mb-3">Excel File Format</h2>
                    <div className="bg-white rounded border border-gray-300 overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-100">
                                <tr>
                                    <th className="px-4 py-2 text-left font-semibold">Column A</th>
                                    <th className="px-4 py-2 text-left font-semibold">Column B</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr className="border-t border-gray-200">
                                    <td className="px-4 py-2 font-mono text-gray-600">username</td>
                                    <td className="px-4 py-2 font-mono text-gray-600">password</td>
                                </tr>
                                <tr className="border-t border-gray-200 bg-gray-50">
                                    <td className="px-4 py-2 font-mono">user001</td>
                                    <td className="px-4 py-2 font-mono">Pass@123</td>
                                </tr>
                                <tr className="border-t border-gray-200">
                                    <td className="px-4 py-2 font-mono">user002</td>
                                    <td className="px-4 py-2 font-mono">Pass@456</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                        * Row 1 can be header (will be skipped automatically)
                    </p>
                </div>

                {/* CTA */}
                <Button
                    onClick={() => setIsModalOpen(true)}
                    size="lg"
                    className="bg-red-600 hover:bg-red-700"
                >
                    🗑️ Start Delete Accounts
                </Button>

                <DeleteAccountModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                />
            </div>
        </ProtectedRoute>
    )
}
