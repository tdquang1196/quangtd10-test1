import { axiosMeduverse } from '../axios'

export async function searchBatchUsers(data: { listUserNames: string[] }) {
  const response = await axiosMeduverse.post(`/manage/SearchBatchUsers`, data)
  return response
}

export async function givePackageToUser(payload: {
  subscriptionId: string
  userId: string
  description: string
  source: number
  requester: string
}) {
  const response = await axiosMeduverse.post(`/manage/Subscription/Admin-Give`, payload)
  return response
}

export async function getSubscriptions() {
  const response = await axiosMeduverse.get(`/manage/subcriptions`)
  return response
}
