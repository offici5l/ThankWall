import { Wall } from '@/components/Wall'

export default function Page() {
  return <Wall description={process.env.DESCRIPTION} />
}
