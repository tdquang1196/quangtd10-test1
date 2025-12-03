import React from 'react'

interface TableProps {
  children: React.ReactNode
  className?: string
}

export const Table: React.FC<TableProps> = ({ children, className = '' }) => {
  return (
    <div className={`overflow-hidden rounded-xl border border-gray-200 shadow-lg ${className}`}>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          {children}
        </table>
      </div>
    </div>
  )
}

interface TableHeaderProps {
  children: React.ReactNode
  sticky?: boolean
}

export const TableHeader: React.FC<TableHeaderProps> = ({ children, sticky = false }) => {
  return (
    <thead className={`bg-gradient-to-r from-gray-50 to-gray-100 ${sticky ? 'sticky top-0 z-10' : ''}`}>
      {children}
    </thead>
  )
}

interface TableBodyProps {
  children: React.ReactNode
}

export const TableBody: React.FC<TableBodyProps> = ({ children }) => {
  return (
    <tbody className="divide-y divide-gray-200 bg-white">
      {children}
    </tbody>
  )
}

interface TableRowProps {
  children: React.ReactNode
  className?: string
}

export const TableRow: React.FC<TableRowProps> = ({ children, className = '' }) => {
  return (
    <tr className={`hover:bg-gray-50 transition-colors ${className}`}>
      {children}
    </tr>
  )
}

interface TableHeadProps {
  children: React.ReactNode
  className?: string
}

export const TableHead: React.FC<TableHeadProps> = ({ children, className = '' }) => {
  return (
    <th className={`px-4 py-3 text-left text-sm font-bold text-gray-700 uppercase tracking-wider ${className}`}>
      {children}
    </th>
  )
}

interface TableCellProps {
  children: React.ReactNode
  className?: string
}

export const TableCell: React.FC<TableCellProps> = ({ children, className = '' }) => {
  return (
    <td className={`px-4 py-3 text-sm text-gray-900 ${className}`}>
      {children}
    </td>
  )
}
