'use client'

import { useState } from 'react'
import MigrationModal from '@/components/MigrationModal'

export default function Home() {
  const [isModalOpen, setIsModalOpen] = useState(false)

  return (
    <main style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        textAlign: 'center'
      }}>
        <h1 style={{ marginBottom: '20px', fontSize: '24px', fontWeight: 'bold' }}>
          User Migration Tool
        </h1>
        <button
          onClick={() => setIsModalOpen(true)}
          style={{
            backgroundColor: '#007bff',
            color: 'white',
            padding: '12px 24px',
            border: 'none',
            borderRadius: '6px',
            fontSize: '16px',
            fontWeight: '500',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}
        >
          Open Migration Tool
        </button>
      </div>

      <MigrationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </main>
  )
}
