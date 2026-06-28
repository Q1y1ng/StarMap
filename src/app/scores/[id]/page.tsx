export default async function ScoreDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">成绩详情</h1>
      <p className="text-zinc-500">成绩 ID: {id}</p>
    </div>
  )
}
