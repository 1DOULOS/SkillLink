import { useEffect, useState } from 'react'
import Sidebar from '../../components/common/Sidebar'
import Navbar from '../../components/common/Navbar'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import Pagination from '../../components/common/Pagination'
import Modal from '../../components/common/Modal'
import { adminAPI } from '../../services/api'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

const TABS = ['all', 'student', 'recruiter'] as const

export default function UserManagement() {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<string>('all')
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [deleteUser, setDeleteUser] = useState<any>(null)
  const [deleting, setDeleting] = useState(false)

  const fetch = async (role = tab, p = page, q = search) => {
    setLoading(true)
    try {
      const params: any = { page: p, limit: 15 }
      if (role !== 'all') params.role = role
      if (q) params.search = q
      const res = await adminAPI.getAllUsers(params)
      const d = res.data.data
      setUsers(d.users || d || [])
      setTotal(d.total || 0)
      setPages(d.pages || 1)
    } catch { toast.error('Failed to load users') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetch() }, [tab, page])

  const toggleStatus = async (user: any) => {
    try {
      await adminAPI.updateUserStatus(user.id, !user.is_active)
      toast.success(`User ${user.is_active ? 'deactivated' : 'activated'}`)
      fetch()
    } catch { toast.error('Failed to update status') }
  }

  const handleDelete = async () => {
    if (!deleteUser) return
    setDeleting(true)
    try {
      await adminAPI.deleteUser(deleteUser.id)
      toast.success('User deleted')
      setDeleteUser(null)
      fetch()
    } catch { toast.error('Failed to delete user') }
    finally { setDeleting(false) }
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
              <p className="text-gray-500 text-sm">{total} total users</p>
            </div>

            <div className="flex flex-wrap gap-3 mb-6">
              <div className="flex gap-2">
                {TABS.map(t => (
                  <button key={t} onClick={() => { setTab(t); setPage(1) }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${tab === t ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
                    {t}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 ml-auto">
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && fetch()}
                  className="input-field w-56"
                  placeholder="Search by email..."
                />
                <button onClick={() => fetch()} className="btn-primary px-4">Search</button>
              </div>
            </div>

            {loading ? <LoadingSpinner /> : (
              <>
                <div className="card overflow-x-auto p-0">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        {['Email', 'Role', 'Status', 'Joined', 'Actions'].map(h => (
                          <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {users.map(user => (
                        <tr key={user.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-gray-900">{user.email}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${
                              user.role === 'admin' ? 'bg-red-100 text-red-700'
                              : user.role === 'recruiter' ? 'bg-purple-100 text-purple-700'
                              : 'bg-blue-100 text-blue-700'
                            }`}>{user.role}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${user.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                              {user.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-500">{format(new Date(user.created_at), 'MMM dd, yyyy')}</td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              <button onClick={() => toggleStatus(user)}
                                className={`text-xs px-2 py-1 rounded transition-colors ${user.is_active ? 'text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'}`}>
                                {user.is_active ? 'Deactivate' : 'Activate'}
                              </button>
                              {user.role !== 'admin' && (
                                <button onClick={() => setDeleteUser(user)} className="text-xs px-2 py-1 text-red-500 hover:bg-red-50 rounded transition-colors">Delete</button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {users.length === 0 && (
                    <div className="text-center py-10 text-gray-400">No users found</div>
                  )}
                </div>
                <div className="mt-4"><Pagination currentPage={page} totalPages={pages} onPageChange={setPage} /></div>
              </>
            )}
          </div>
        </main>
      </div>

      <Modal isOpen={!!deleteUser} onClose={() => setDeleteUser(null)} title="Delete User">
        <p className="text-gray-600 mb-4">Permanently delete <strong>{deleteUser?.email}</strong>? This cannot be undone.</p>
        <div className="flex gap-3">
          <button onClick={() => setDeleteUser(null)} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleDelete} disabled={deleting} className="btn-danger flex-1">{deleting ? 'Deleting...' : 'Delete User'}</button>
        </div>
      </Modal>
    </div>
  )
}
