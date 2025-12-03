import { axiosMeduverse } from '../axios'

export async function searchBatchUsers(data: { listUserNames: string[] }) {
  const response = await axiosMeduverse.post(`/manage/SearchBatchUsers`, data)
  return response
}

export async function givePackageToUser(payload: {
  packageId: string
  userId: string
  description: string
  source: number
  requester: string
}) {
  const response = await axiosMeduverse.post(`/manage/GivePackageToUser`, payload)
  return response
}
