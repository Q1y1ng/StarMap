export default async function StudentProfilePage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">学生画像</h1>
      <p className="text-zinc-500">学生 ID: {id}</p>
    </div>
  )
}
